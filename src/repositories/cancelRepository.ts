import { prisma } from '../config/database'

export const cancelRepository = {
  async findByToken(token: string) {
    return prisma.appointment.findUnique({
      where: { cancelToken: token },
      include: {
        services: {
          include: { service: { select: { name: true } } },
        },
      },
    })
  },

  async cancelByToken(token: string) {
    return prisma.appointment.update({
      where: { cancelToken: token },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
  },
}
