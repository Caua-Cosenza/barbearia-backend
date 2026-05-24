import type { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    return reply.status(401).send({
      success: false,
      data: null,
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      timestamp: new Date().toISOString(),
    })
  }
}

export async function authenticateAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
    const payload = req.user as { role?: string }
    if (payload.role !== 'ADMIN') {
      return reply.status(403).send({
        success: false,
        data: null,
        error: 'Forbidden',
        message: 'Admin access required',
        timestamp: new Date().toISOString(),
      })
    }
  } catch {
    return reply.status(401).send({
      success: false,
      data: null,
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      timestamp: new Date().toISOString(),
    })
  }
}
