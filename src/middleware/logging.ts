import type { FastifyRequest, FastifyReply } from 'fastify'
import { logger } from '../utils/logger'

export async function requestLogger(req: FastifyRequest, _reply: FastifyReply) {
  // Sanitize — never log Authorization header or body
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }, 'Incoming request')
}

export async function suspiciousActivityLogger(req: FastifyRequest, _reply: FastifyReply) {
  const suspicious = [
    req.url.includes('..'),
    req.url.includes('<script'),
    req.url.includes('SELECT '),
    req.url.includes('DROP '),
    req.url.length > 2000,
  ]

  if (suspicious.some(Boolean)) {
    logger.warn({
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.headers['user-agent'],
    }, 'Suspicious request detected')
  }
}
