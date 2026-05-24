import { v4 as uuidv4 } from 'uuid'
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
    const slotTaken = await appointmentRepository.isSlotTaken(
      dto.professionalId,
      scheduledAt,
      totalDurationMinutes,
    )
    if (slotTaken) {
      throw Object.assign(new Error('Time slot is not available'), { statusCode: 409 })
    }

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
