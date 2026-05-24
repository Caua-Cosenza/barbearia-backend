import type { FastifyRequest, FastifyReply } from 'fastify'
import { createPublicAppointmentSchema } from '../dtos/requests/CreateAppointmentDto'
import { appointmentService } from '../services/appointmentService'
import { createApiResponse } from '../utils/validation'

export const publicAppointmentController = {
  async create(req: FastifyRequest, reply: FastifyReply) {
    const body = createPublicAppointmentSchema.parse(req.body)
    const appointment = await appointmentService.createPublic(body)
    return reply.status(201).send(createApiResponse(appointment, 'Appointment created'))
  },
}
