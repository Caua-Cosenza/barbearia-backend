import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateAdmin } from '../middleware/auth'
import { adminController } from '../controllers/adminController'
import { prisma } from '../config/database'
import { createApiResponse } from '../utils/validation'

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateAdmin)

  app.get('/health', async (_req, reply) => {
    return reply.send({
      success: true,
      data: { status: 'admin ok' },
      error: null,
      message: 'Admin route active',
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/v1/admin/appointments?date=YYYY-MM-DD
  app.get('/appointments', adminController.getAppointments)

  // PUT /api/v1/admin/appointments/:id/status
  app.put('/appointments/:id/status', adminController.updateStatus)

  // GET /api/v1/admin/stats
  app.get('/stats', adminController.getStats)

  // POST /api/v1/admin/push-subscription — save/update push subscription
  app.post('/push-subscription', async (req, reply) => {
    const body = pushSubscriptionSchema.parse(req.body)
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      update: { p256dh: body.keys.p256dh, auth: body.keys.auth },
      create: { endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth },
    })
    return reply.status(201).send(createApiResponse(null, 'Subscription saved'))
  })
}
