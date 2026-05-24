import { prisma } from '../config/database'
import type { AppointmentStatus } from '@prisma/client'

export const appointmentRepository = {
  async findById(id: string) {
    return prisma.appointment.findUnique({
      where: { id },
      include: {
        service: { select: { id: true, name: true, durationMinutes: true } },
        professional: { select: { id: true, nameEncrypted: true } },
        services: {
          include: { service: { select: { name: true } } },
        },
      },
    })
  },

  async findByUser(userId: string) {
    return prisma.appointment.findMany({
      where: { userId },
      orderBy: { scheduledAt: 'desc' },
      include: {
        service: { select: { id: true, name: true, durationMinutes: true } },
        professional: { select: { id: true, nameEncrypted: true } },
        services: {
          include: { service: { select: { name: true } } },
        },
      },
    })
  },

  async create(data: {
    userId: string
    professionalId: string
    serviceId: string
    amountCents: number
    scheduledAt: Date
    notes?: string
  }) {
    return prisma.appointment.create({ data })
  },

  async updateStatus(id: string, status: AppointmentStatus) {
    return prisma.appointment.update({ where: { id }, data: { status } })
  },

  async isSlotTaken(professionalId: string, scheduledAt: Date, durationMinutes: number) {
    const end = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000)
    const conflict = await prisma.appointment.findFirst({
      where: {
        professionalId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { gte: scheduledAt, lt: end },
      },
    })
    return !!conflict
  },

  // Returns active appointments for a professional inside a local-time day window.
  // Pass Date objects built from local midnight / end-of-day so Prisma converts
  // them to the same UTC reference used when scheduledAt was stored.
  async findByProfessionalAndDate(professionalId: string, dayStart: Date, dayEnd: Date) {
    return prisma.appointment.findMany({
      where: {
        professionalId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        scheduledAt: true,
        service: { select: { durationMinutes: true } },
        services: { select: { durationMinutes: true } },
      },
    })
  },

  async createPublic(data: {
    professionalId: string
    serviceId: string
    amountCents: number
    scheduledAt: Date
    cancelToken: string
    guestNameEncrypted: string
    guestPhoneEncrypted: string
    guestEmailEncrypted?: string | null
    notes?: string
    services: Array<{ serviceId: string; amountCents: number; durationMinutes: number }>
  }) {
    const { services, ...appointmentData } = data
    return prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appointment = await tx.appointment.create({ data: { ...appointmentData, userId: null } as any })
      await tx.appointmentService.createMany({
        data: services.map((s) => ({
          appointmentId: appointment.id,
          serviceId: s.serviceId,
          amountCents: s.amountCents,
          durationMinutes: s.durationMinutes,
        })),
      })
      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: {
          services: { include: { service: { select: { name: true } } } },
          professional: { select: { id: true, nameEncrypted: true } },
        },
      })
    })
  },
}
