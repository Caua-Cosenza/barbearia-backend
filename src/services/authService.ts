import bcrypt from 'bcrypt'
import { createHash } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { userRepository } from '../repositories/userRepository'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { decrypt } from '../utils/encryption'
import { PASSWORD_HASH_ROUNDS, TOKEN_EXPIRY } from '../utils/constants'
import type { CreateUserDto } from '../dtos/requests/CreateUserDto'
import type { LoginDto } from '../dtos/requests/LoginDto'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const authService = {
  async register(app: FastifyInstance, dto: CreateUserDto) {
    const existing = await userRepository.findByEmail(dto.email)
    if (existing) {
      throw Object.assign(new Error('Email already registered'), { statusCode: 409 })
    }
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS)
    const user = await userRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      phone: dto.phone,
    })
    return { id: user.id, email: user.email }
  },

  async login(app: FastifyInstance, dto: LoginDto) {
    const user = await userRepository.findByEmail(dto.email)
    // Constant-time comparison even if user not found
    const hash = user?.passwordHash ?? '$2b$12$invalidhashfortimingequalit'
    const valid = await bcrypt.compare(dto.password, hash)
    if (!user || !valid) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
    }

    const payload = { sub: user.id, role: user.role }
    const accessToken = signAccessToken(app, payload)
    const refreshToken = signRefreshToken(app, { sub: user.id })

    await userRepository.storeRefreshToken(
      user.id,
      hashToken(refreshToken),
      new Date(Date.now() + TOKEN_EXPIRY.REFRESH_REDIS_SECONDS * 1000),
    )

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: decrypt(user.nameEncrypted), email: user.email },
    }
  },

  async refresh(app: FastifyInstance, refreshToken: string) {
    let payload: { sub: string }
    try {
      payload = verifyRefreshToken(app, refreshToken)
    } catch {
      throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 })
    }

    const stored = await userRepository.findRefreshToken(hashToken(refreshToken))
    if (!stored || stored.expiresAt < new Date()) {
      throw Object.assign(new Error('Refresh token expired or revoked'), { statusCode: 401 })
    }

    const user = await userRepository.findById(payload.sub)
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })

    // Rotate: invalidate old, issue new
    await userRepository.deleteRefreshToken(hashToken(refreshToken))
    const newAccess = signAccessToken(app, { sub: user.id, role: user.role })
    const newRefresh = signRefreshToken(app, { sub: user.id })

    await userRepository.storeRefreshToken(
      user.id,
      hashToken(newRefresh),
      new Date(Date.now() + TOKEN_EXPIRY.REFRESH_REDIS_SECONDS * 1000),
    )

    return { accessToken: newAccess, refreshToken: newRefresh }
  },

  async logout(userId: string, refreshToken: string) {
    await userRepository.deleteRefreshToken(hashToken(refreshToken))
  },
}
