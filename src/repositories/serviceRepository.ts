import { prisma } from '../config/database'

export const serviceRepository = {
  async findAll() {
    return prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        amountCents: true,
        durationMinutes: true,
      },
    })
  },

  async findById(id: string) {
    return prisma.service.findUnique({
      where: { id, isActive: true },
    })
  },

  // Used internally by service layer — amount fetched here, never from client
  async getAmountCents(serviceId: string): Promise<number> {
    const service = await prisma.service.findUniqueOrThrow({
      where: { id: serviceId },
      select: { amountCents: true },
    })
    return service.amountCents
  },

  async findManyByIds(ids: string[]) {
    return prisma.service.findMany({
      where: { id: { in: ids }, isActive: true },
    })
  },
}
