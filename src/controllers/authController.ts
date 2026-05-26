import type { FastifyRequest, FastifyReply } from 'fastify'
import type { CookieSerializeOptions } from '@fastify/cookie'
import { authService } from '../services/authService'
import { CreateUserSchema } from '../dtos/requests/CreateUserDto'
import { LoginSchema } from '../dtos/requests/LoginDto'
import { createApiResponse } from '../utils/validation'

const isProd = process.env.NODE_ENV === 'production'

const COOKIE_OPTS: CookieSerializeOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'strict',
  path: '/',
  domain: isProd ? '.barbeariajhonatan.com' : undefined,
}

export const authController = {
  async register(req: FastifyRequest, reply: FastifyReply) {
    const body = CreateUserSchema.parse(req.body)
    const user = await authService.register(req.server, body)
    return reply.status(201).send(createApiResponse(user, 'Account created'))
  },

  async login(req: FastifyRequest, reply: FastifyReply) {
    const body = LoginSchema.parse(req.body)
    const result = await authService.login(req.server, body)

    reply.setCookie('access_token', result.accessToken, {
      ...COOKIE_OPTS,
      maxAge: 15 * 60,
    })
    reply.setCookie('refresh_token', result.refreshToken, {
      ...COOKIE_OPTS,
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/v1/auth/refresh',
    })

    return reply.send(createApiResponse({ user: result.user }, 'Login successful'))
  },

  async refresh(req: FastifyRequest, reply: FastifyReply) {
    const refreshToken = req.cookies['refresh_token']
    if (!refreshToken) {
      return reply.status(401).send({
        success: false, data: null, error: 'Unauthorized',
        message: 'Refresh token missing', timestamp: new Date().toISOString(),
      })
    }
    const tokens = await authService.refresh(req.server, refreshToken)
    reply.setCookie('access_token', tokens.accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 })
    reply.setCookie('refresh_token', tokens.refreshToken, {
      ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60, path: '/api/v1/auth/refresh',
    })
    return reply.send(createApiResponse(null, 'Token refreshed'))
  },

  async logout(req: FastifyRequest, reply: FastifyReply) {
    const refreshToken = req.cookies['refresh_token']
    if (refreshToken) {
      const user = req.user as { id: string }
      await authService.logout(user.id, refreshToken)
    }
    reply.clearCookie('access_token', COOKIE_OPTS)
    reply.clearCookie('refresh_token', { ...COOKIE_OPTS, path: '/api/v1/auth/refresh' })
    return reply.send(createApiResponse(null, 'Logged out'))
  },
}