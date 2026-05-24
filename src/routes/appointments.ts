import type { FastifyInstance } from 'fastify'
import { appointmentController } from '../controllers/appointmentController'
import { publicAppointmentController } from '../controllers/publicAppointmentController'
import { authenticate } from '../middleware/auth'
import { rejectAmountInBody } from '../middleware/validation'
import { bookingRateLimit } from '../middleware/rateLimiter'

export async function appointmentsRoutes(app: FastifyInstance) {
  // ── Public (no auth) ────────────────────────────────────────────────────────
  // POST /api/v1/appointments/public
  // Guest booking: name + phone, no account required.
  // amount is never accepted from the client — fetched from DB by serviceId.
  app.post('/public', {
    ...bookingRateLimit,
    preHandler: [rejectAmountInBody],
    handler: publicAppointmentController.create,
  })

  // ── Authenticated ────────────────────────────────────────────────────────────
  app.post('/', {
    preHandler: [authenticate, rejectAmountInBody],
    ...bookingRateLimit,
    handler: appointmentController.create,
  })

  app.get('/', {
    preHandler: [authenticate],
    handler: appointmentController.list,
  })

  app.delete('/:id', {
    preHandler: [authenticate],
    handler: appointmentController.cancel,
  })
}
