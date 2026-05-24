import { prisma } from '../config/database'
import { encrypt } from '../utils/encryption'

export const userRepository = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } })
  },

  async create(data: { email: string; passwordHash: string; name: string; phone: string }) {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        nameEncrypted: encrypt(data.name),
        phoneEncrypted: encrypt(data.phone),
      },
    })
  },

  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    })
  },

  async findRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } })
  },

  async deleteRefreshToken(tokenHash: string) {
    return prisma.refreshToken.delete({ where: { tokenHash } })
  },

  async deleteAllRefreshTokens(userId: string) {
    return prisma.refreshToken.deleteMany({ where: { userId } })
  },
}
