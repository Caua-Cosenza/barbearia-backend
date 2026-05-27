import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/database'
import { createApiResponse, createErrorResponse } from '../utils/validation'

const createBlockedSlotSchema = z.object({
  professionalId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime must be HH:MM'),
  reason: z.string().max(200).optional(),
}).strict().refine((d) => d.startTime < d.endTime, {
  message: 'startTime must be earlier than endTime',
  path: ['startTime'],
})

const listQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalId: z.string().uuid(),
})

const deleteParamsSchema = z.object({
  id: z.string().uuid(),
})

export const blockedSlotsController = {
  async create(req: FastifyRequest, reply: FastifyReply) {
    const body = createBlockedSlotSchema.parse(req.body)

    const today = new Date().toISOString().split('T')[0]
    if (body.date < today) {
      return reply
        .status(400)
        .send(createErrorResponse('Bad Request', 'Cannot block slots in the past'))
    }

    const slot = await prisma.blockedSlot.create({ data: body })
    return reply.status(201).send(createApiResponse(slot, 'Slot blocked'))
  },

  async list(req: FastifyRequest, reply: FastifyReply) {
    const { date, professionalId } = listQuerySchema.parse(req.query)

    const slots = await prisma.blockedSlot.findMany({
      where: { date, professionalId },
      orderBy: { startTime: 'asc' },
    })
    return reply.send(createApiResponse(slots))
  },

  async remove(req: FastifyRequest, reply: FastifyReply) {
    const { id } = deleteParamsSchema.parse(req.params)

    const existing = await prisma.blockedSlot.findUnique({ where: { id } })
    if (!existing) {
      return reply
        .status(404)
        .send(createErrorResponse('Not Found', 'Blocked slot not found'))
    }

    await prisma.blockedSlot.delete({ where: { id } })
    return reply.send(createApiResponse(null, 'Blocked slot removed'))
  },
}
