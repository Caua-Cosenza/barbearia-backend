import 'dotenv/config'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyJwt from '@fastify/jwt'
import fastifyRateLimit from '@fastify/rate-limit'

import { env } from './config/env'
import { redisClient } from './config/redis'
import { appointmentsRoutes } from './routes/appointments'
import { availableTimesRoutes } from './routes/availableTimes'
import { professionalsRoutes } from './routes/professionals'
import { servicesRoutes } from './routes/services'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { cancelRoutes } from './routes/cancel'
import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'
// import { startReminderJob } from './jobs/reminderJob'

const app = Fastify({ logger: false })

async function bootstrap() {
  // Security headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })

  // CORS
  await app.register(fastifyCors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  // Cookies (HttpOnly for tokens)
  await app.register(fastifyCookie, {
    secret: env.JWT_SECRET,
    hook: 'onRequest',
  })

  // JWT
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: 'access_token', signed: false },
  })

  // Rate limiting (Redis-backed)
  await app.register(fastifyRateLimit, {
    max: 30,
    timeWindow: '1 minute',
    redis: redisClient,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      success: false,
      error: 'Too many requests',
      message: 'Rate limit exceeded. Try again in 1 minute.',
      data: null,
      timestamp: new Date().toISOString(),
    }),
  })

  // Error handler
  app.setErrorHandler(errorHandler)

  // Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  await app.register(appointmentsRoutes, { prefix: '/api/v1/appointments' })
  await app.register(availableTimesRoutes, { prefix: '/api/v1/available-times' })
  await app.register(professionalsRoutes, { prefix: '/api/v1/professionals' })
  await app.register(servicesRoutes, { prefix: '/api/v1/services' })
  await app.register(adminRoutes, { prefix: '/api/v1/admin' })
  await app.register(cancelRoutes, { prefix: '/api/v1/cancel' })

  // Health check
  app.get('/health', async () => ({
    success: true,
    data: { status: 'ok' },
    error: null,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  }))

  await app.listen({ port: env.PORT, host: env.HOST })
  logger.info(`Server running on http://${env.HOST}:${env.PORT}`)

  // if (env.NODE_ENV !== 'test') {
  //   startReminderJob()
  //   logger.info('Reminder job started')
  // }
}

bootstrap().catch((err) => {
  logger.error(err, 'Failed to start server')
  process.exit(1)
})
