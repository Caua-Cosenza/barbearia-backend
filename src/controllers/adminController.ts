import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { adminService } from '../services/adminService'
import { createApiResponse } from '../utils/validation'

// PENDING is intentionally excluded — admin cannot reset an appointment to pending.
const UpdateStatusSchema = z
  .object({ status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']) })
  .strict()

const DateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD format')
    .optional(),
})

export const adminController = {
  async getAppointments(
    req: FastifyRequest<{ Querystring: { date?: string } }>,
    reply: FastifyReply,
  ) {
    const { date } = DateQuerySchema.parse(req.query)
    const targetDate = date ?? new Date().toISOString().split('T')[0]
    const appointments = await adminService.getAppointmentsByDate(targetDate)
    return reply.send(createApiResponse(appointments))
  },

  async updateStatus(
    req: FastifyRequest<{ Params: { id: string }; Body: { status: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = req.params
    const { status } = UpdateStatusSchema.parse(req.body)
    const result = await adminService.updateAppointmentStatus(id, status as 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW')
    return reply.send(createApiResponse(result, 'Status atualizado'))
  },

  async getStats(_req: FastifyRequest, reply: FastifyReply) {
    const stats = await adminService.getStats()
    return reply.send(createApiResponse(stats))
  },
}
