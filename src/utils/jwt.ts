import type { FastifyInstance } from 'fastify'
import { env } from '../config/env'

export interface JwtPayload {
  sub: string
  role: string
  iat?: number
  exp?: number
}

export function signAccessToken(app: FastifyInstance, payload: JwtPayload): string {
  return app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRES })
}

export function signRefreshToken(app: FastifyInstance, payload: Pick<JwtPayload, 'sub'>): string {
  return app.jwt.sign(payload, {
    key: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_REFRESH_EXPIRES,
  })
}

export function verifyRefreshToken(app: FastifyInstance, token: string): Pick<JwtPayload, 'sub'> {
  return app.jwt.verify<Pick<JwtPayload, 'sub'>>(token, { key: env.JWT_REFRESH_SECRET })
}
