import type { FastifyRequest, FastifyReply } from 'fastify'
import { appointmentService } from '../services/appointmentService'
import { CreateAppointmentSchema } from '../dtos/requests/CreateAppointmentDto'
import { createApiResponse } from '../utils/validation'
import type { AuthUser } from '../types'

export const appointmentController = {
  async create(req: FastifyRequest, reply: FastifyReply) {
    const body = CreateAppointmentSchema.parse(req.body)
    const user = req.user as AuthUser
    const appointment = await appointmentService.create(user.id, body)
    return reply.status(201).send(createApiResponse(appointment, 'Appointment created'))
  },

  async list(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user as AuthUser
    const appointments = await appointmentService.listByUser(user.id)
    return reply.send(createApiResponse(appointments))
  },

  async cancel(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const user = req.user as AuthUser
    await appointmentService.cancel(user.id, req.params.id)
    return reply.send(createApiResponse(null, 'Appointment cancelled'))
  },
}
