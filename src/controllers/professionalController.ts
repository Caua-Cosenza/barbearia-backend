import type { FastifyRequest, FastifyReply } from 'fastify'
import { professionalService } from '../services/professionalService'
import { createApiResponse } from '../utils/validation'

export const professionalController = {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const professionals = await professionalService.listAll()
    return reply.send(createApiResponse(professionals))
  },

  async getById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const professional = await professionalService.findById(req.params.id)
    return reply.send(createApiResponse(professional))
  },
}
