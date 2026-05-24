import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { logger } from '../utils/logger'

export function errorHandler(
  error: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(422).send({
      success: false,
      data: null,
      error: 'Validation Error',
      message: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      timestamp: new Date().toISOString(),
    })
  }

  // Known HTTP errors
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      success: false,
      data: null,
      error: error.name || 'Client Error',
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }

  // Unexpected errors — never expose internals
  logger.error({ err: error, url: req.url, method: req.method }, 'Unhandled error')

  return reply.status(500).send({
    success: false,
    data: null,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  })
}
