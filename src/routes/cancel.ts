import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { cancelRepository } from '../repositories/cancelRepository'
import { decrypt } from '../utils/encryption'
import { whatsappService } from '../services/whatsappService'
import { sendPushToAll } from '../services/pushService'
import { env } from '../config/env'
import { createApiResponse } from '../utils/validation'

const cancelTokenSchema = z.string().uuid('Token inválido')

const ONE_HOUR_MS = 60 * 60 * 1000

export async function cancelRoutes(app: FastifyInstance) {
  // GET /api/v1/cancel/:token — preview appointment before confirming cancellation
  app.get<{ Params: { token: string } }>('/:token', async (req, reply) => {
    const token = cancelTokenSchema.parse(req.params.token)
    const appointment = await cancelRepository.findByToken(token)

    if (!appointment) {
      return reply.status(404).send({
        success: false,
        data: null,
        error: 'Agendamento não encontrado',
        message: 'Agendamento não encontrado',
        timestamp: new Date().toISOString(),
      })
    }

    const guestName = appointment.guestNameEncrypted ? decrypt(appointment.guestNameEncrypted) : ''
    const totalAmountCents = appointment.services.reduce((sum, s) => sum + s.amountCents, 0)
    const totalDurationMinutes = appointment.services.reduce((sum, s) => sum + s.durationMinutes, 0)

    const isCancellableStatus = appointment.status === 'PENDING' || appointment.status === 'CONFIRMED'
    const canCancel = isCancellableStatus && appointment.scheduledAt.getTime() - Date.now() > ONE_HOUR_MS

    return reply.send(
      createApiResponse({
        id: appointment.id,
        guestName,
        scheduledAt: appointment.scheduledAt.toISOString(),
        status: appointment.status,
        services: appointment.services.map((as) => ({
          name: as.service.name,
          amountCents: as.amountCents,
          durationMinutes: as.durationMinutes,
        })),
        totalAmountCents,
        totalDurationMinutes,
        canCancel,
      }),
    )
  })

  // POST /api/v1/cancel/:token — confirm cancellation
  app.post<{ Params: { token: string } }>('/:token', async (req, reply) => {
    const token = cancelTokenSchema.parse(req.params.token)
    const appointment = await cancelRepository.findByToken(token)

    if (!appointment) {
      return reply.status(404).send({
        success: false,
        data: null,
        error: 'Agendamento não encontrado',
        message: 'Agendamento não encontrado',
        timestamp: new Date().toISOString(),
      })
    }

    if (appointment.status !== 'PENDING' && appointment.status !== 'CONFIRMED') {
      return reply.status(400).send({
        success: false,
        data: null,
        error: 'Agendamento não pode ser cancelado',
        message: 'Agendamento não pode ser cancelado',
        timestamp: new Date().toISOString(),
      })
    }

    if (appointment.scheduledAt.getTime() - Date.now() < ONE_HOUR_MS) {
      return reply.status(400).send({
        success: false,
        data: null,
        error: 'Prazo de cancelamento encerrado. Entre em contato com a barbearia.',
        message: 'Prazo de cancelamento encerrado. Entre em contato com a barbearia.',
        timestamp: new Date().toISOString(),
      })
    }

    await cancelRepository.cancelByToken(token)

    const cancelledGuestName = appointment.guestNameEncrypted ? decrypt(appointment.guestNameEncrypted) : ''
    void whatsappService.sendBarberCancellation(env.BARBER_PHONE ?? '', {
      guestName: cancelledGuestName,
      scheduledAt: appointment.scheduledAt,
      services: appointment.services.map((as) => ({ name: as.service.name })),
    })
    void sendPushToAll({
      title: '❌ Agendamento cancelado',
      body: `${cancelledGuestName} — ${appointment.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`,
    })

    return reply.send({
      success: true,
      data: null,
      error: null,
      message: 'Agendamento cancelado com sucesso',
      timestamp: new Date().toISOString(),
    })
  })
}
