import type { FastifyInstance } from 'fastify'
import { availableTimesController } from '../controllers/availableTimesController'
import { availableTimesRateLimit } from '../middleware/rateLimiter'

export async function availableTimesRoutes(app: FastifyInstance) {
  // No authentication required — public endpoint
  app.post('/', { ...availableTimesRateLimit }, availableTimesController.fetch)
}
