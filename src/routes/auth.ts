import type { FastifyInstance } from 'fastify'
import { authController } from '../controllers/authController'
import { authenticate } from '../middleware/auth'
import { authRateLimit } from '../middleware/rateLimiter'

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', { ...authRateLimit, handler: authController.register })
  app.post('/login', { ...authRateLimit, handler: authController.login })
  app.post('/refresh', { ...authRateLimit, handler: authController.refresh })
  app.post('/logout', { preHandler: [authenticate], handler: authController.logout })
}
