import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../config/database'
import { appointmentRepository } from '../repositories/appointmentRepository'
import { serviceRepository } from '../repositories/serviceRepository'
import { professionalRepository } from '../repositories/professionalRepository'
import { decrypt, encrypt } from '../utils/encryption'
import { whatsappService } from './whatsappService'
import { sendPushToAll } from './pushService'
import { env } from '../config/env'
import type { CreateAppointmentDto, CreatePublicAppointmentDto } from '../dtos/requests/CreateAppointmentDto'
import type { AppointmentResponseDto, PublicAppointmentResponseDto } from '../dtos/responses/AppointmentResponseDto'

export const appointmentService = {
  async create(userId: string, dto: CreateAppointmentDto): Promise<AppointmentResponseDto> {
    const service = await serviceRepository.findById(dto.serviceId)
    if (!service) throw Object.assign(new Error('Service not found'), { statusCode: 404 })

    const professional = await professionalRepository.findById(dto.professionalId)
    if (!professional) throw Object.assign(new Error('Professional not found'), { statusCode: 404 })

    const scheduledAt = new Date(dto.scheduledAt)
    const slotTaken = await appointmentRepository.isSlotTaken(
      dto.professionalId,
      scheduledAt,
      service.durationMinutes,
    )
    if (slotTaken) {
      throw Object.assign(new Error('Time slot is not available'), { statusCode: 409 })
    }

    // Amount ALWAYS from database — never from client
    const amountCents = await serviceRepository.getAmountCents(dto.serviceId)

    const appointment = await appointmentRepository.create({
      userId,
      professionalId: dto.professionalId,
      serviceId: dto.serviceId,
      amountCents,
      scheduledAt,
      notes: dto.notes,
    })

    return {
      id: appointment.id,
      scheduledAt: appointment.scheduledAt.toISOString(),
      status: appointment.status,
      notes: appointment.notes,
      service: {
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
      },
      professional: {
        id: professional.id,
        name: decrypt(professional.nameEncrypted),
      },
      createdAt: appointment.createdAt.toISOString(),
    }
  },

  async listByUser(userId: string): Promise<AppointmentResponseDto[]> {
    const appointments = await appointmentRepository.findByUser(userId)
    return appointments.map((a) => ({
      id: a.id,
      scheduledAt: a.scheduledAt.toISOString(),
      status: a.status,
      notes: a.notes,
      service: {
        id: a.service.id,
        name: a.service.name,
        durationMinutes: a.service.durationMinutes,
      },
      professional: {
        id: a.professional.id,
        name: decrypt(a.professional.nameEncrypted),
      },
      createdAt: a.createdAt.toISOString(),
    }))
  },

  async createPublic(dto: CreatePublicAppointmentDto): Promise<PublicAppointmentResponseDto> {
    const professional = await professionalRepository.findById(dto.professionalId)
    if (!professional) throw Object.assign(new Error('Professional not found'), { statusCode: 404 })

    const services = await serviceRepository.findManyByIds(dto.serviceIds)

    // Validate every requested service was found and is active
    const missingId = dto.serviceIds.find((id) => !services.some((s) => s.id === id))
    if (missingId) {
      throw Object.assign(new Error(`Service not found: ${missingId}`), { statusCode: 404 })
    }

    const totalAmountCents = services.reduce((sum, s) => sum + s.amountCents, 0)
    const totalDurationMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0)

    const scheduledAt = new Date(dto.scheduledAt)

    // Fix 7: Reject bookings scheduled in the past
    if (scheduledAt <= new Date()) {
      throw Object.assign(new Error('Não é possível agendar no passado'), { statusCode: 400 })
    }

    // Fix 2A: Professional must have availability configured for this day of week
    const [y, mo, d] = dto.scheduledAt.split('T')[0].split('-').map(Number)
    const dayOfWeek = new Date(y, mo - 1, d).getDay()
    const availability = await prisma.professionalAvailability.findFirst({
      where: { professionalId: dto.professionalId, dayOfWeek },
    })
    if (!availability) {
      throw Object.assign(new Error('Profissional não atende neste dia'), { statusCode: 400 })
    }

    // Fix 2B: Requested time must fall within working hours (Brazil local time UTC-3)
    const brazilLocal = new Date(scheduledAt.getTime() + (-3 * 60 * 60 * 1000))
    const requestedStart = brazilLocal.getUTCHours() * 60 + brazilLocal.getUTCMinutes()
    const [startH, startM] = availability.startTime.split(':').map(Number)
    const [endH, endM] = availability.endTime.split(':').map(Number)
    if (requestedStart < startH * 60 + startM || requestedStart >= endH * 60 + endM) {
      throw Object.assign(new Error('Horário fora do expediente'), { statusCode: 400 })
    }

    // Fix 1: Reject if time overlaps with an admin-blocked slot
    const blockDate = dto.scheduledAt.split('T')[0]
    const blockedSlots = await prisma.blockedSlot.findMany({
      where: { professionalId: dto.professionalId, date: blockDate },
    })
    const slotDuration = Math.min(totalDurationMinutes, 50)
    const slotEndMin = requestedStart + slotDuration
    for (const block of blockedSlots) {
      const [bsh, bsm] = block.startTime.split(':').map(Number)
      const [beh, bem] = block.endTime.split(':').map(Number)
      if (requestedStart < beh * 60 + bem && slotEndMin > bsh * 60 + bsm) {
        throw Object.assign(new Error('Este horário está reservado pelo profissional'), { statusCode: 409 })
      }
    }

    // Fix 3: isSlotTaken moved inside the DB transaction (appointmentRepository.createPublic)

    const cancelToken = uuidv4()
    const guestNameEncrypted = encrypt(dto.guestName)
    const guestPhoneEncrypted = encrypt(dto.guestPhone)
    const guestEmailEncrypted = dto.guestEmail ? encrypt(dto.guestEmail) : null

    const appointment = await appointmentRepository.createPublic({
      professionalId: dto.professionalId,
      serviceId: dto.serviceIds[0],
      amountCents: totalAmountCents,
      scheduledAt,
      cancelToken,
      guestNameEncrypted,
      guestPhoneEncrypted,
      guestEmailEncrypted,
      notes: dto.notes,
      services: services.map((s) => ({
        serviceId: s.id,
        amountCents: s.amountCents,
        durationMinutes: s.durationMinutes,
      })),
    })

    // Fire-and-forget — WhatsApp failures must never break the booking
    void whatsappService.sendWelcomeMessage(dto.guestPhone, {
      guestName: dto.guestName,
      scheduledAt,
      services,
      totalAmountCents,
      cancelToken: appointment.cancelToken!,
    })
    void whatsappService.sendBarberNewAppointment(env.BARBER_PHONE ?? '', {
      guestName: dto.guestName,
      guestPhone: dto.guestPhone,
      scheduledAt,
      services,
      totalAmountCents,
    })
    void sendPushToAll({
      title: '🔔 Novo agendamento!',
      body: `${dto.guestName} — ${scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`,
    })

    return {
      id: appointment.id,
      cancelToken: appointment.cancelToken!,
      scheduledAt: appointment.scheduledAt.toISOString(),
      status: appointment.status,
      notes: appointment.notes,
      services: appointment.services.map((as) => ({
        serviceId: as.serviceId,
        name: as.service.name,
        amountCents: as.amountCents,
        durationMinutes: as.durationMinutes,
      })),
      totalAmountCents,
      totalDurationMinutes,
      professional: {
        id: appointment.professional.id,
        name: decrypt(appointment.professional.nameEncrypted),
      },
    }
  },

  async cancel(userId: string, appointmentId: string): Promise<void> {
    const appointment = await appointmentRepository.findById(appointmentId)
    if (!appointment) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 })
    if (appointment.userId !== userId) {
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
    }
    if (appointment.status === 'CANCELLED') {
      throw Object.assign(new Error('Already cancelled'), { statusCode: 409 })
    }
    await appointmentRepository.updateStatus(appointmentId, 'CANCELLED')
  },
}
