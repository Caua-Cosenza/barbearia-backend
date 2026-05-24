import type { FastifyInstance } from 'fastify'
import { professionalController } from '../controllers/professionalController'

export async function professionalsRoutes(app: FastifyInstance) {
  app.get('/', professionalController.list)
  app.get('/:id', professionalController.getById)
}
