import type { FastifyRequest, FastifyReply } from 'fastify'

// Rejects requests that include 'amount' in the body (price manipulation protection)
export async function rejectAmountInBody(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as Record<string, unknown> | null
  if (body && ('amount' in body || 'price' in body || 'value' in body)) {
    return reply.status(400).send({
      success: false,
      data: null,
      error: 'Bad Request',
      message: 'Invalid request payload',
      timestamp: new Date().toISOString(),
    })
  }
}

// Validates Content-Type for mutation requests
export async function requireJson(req: FastifyRequest, reply: FastifyReply) {
  const method = req.method
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = req.headers['content-type'] ?? ''
    if (!contentType.includes('application/json')) {
      return reply.status(415).send({
        success: false,
        data: null,
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json',
        timestamp: new Date().toISOString(),
      })
    }
  }
}
