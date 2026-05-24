import type { FastifyInstance } from 'fastify'
import { serviceController } from '../controllers/serviceController'

export async function servicesRoutes(app: FastifyInstance) {
  app.get('/', serviceController.list)
  app.get('/:id', serviceController.getById)
}
