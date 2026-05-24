import type { FastifyInstance } from 'fastify'
import { availableTimesController } from '../controllers/availableTimesController'
import { bookingRateLimit } from '../middleware/rateLimiter'

export async function availableTimesRoutes(app: FastifyInstance) {
  // No authentication required — public endpoint
  app.post('/', { ...bookingRateLimit }, availableTimesController.fetch)
}
