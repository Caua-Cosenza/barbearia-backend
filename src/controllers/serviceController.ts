import type { FastifyRequest, FastifyReply } from 'fastify'
import { serviceService } from '../services/serviceService'
import { createApiResponse } from '../utils/validation'

export const serviceController = {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const services = await serviceService.listAll()
    return reply.send(createApiResponse(services))
  },

  async getById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const service = await serviceService.findById(req.params.id)
    return reply.send(createApiResponse(service))
  },
}
