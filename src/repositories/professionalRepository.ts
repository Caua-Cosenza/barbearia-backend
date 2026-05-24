import { prisma } from '../config/database'

export const professionalRepository = {
  async findAll() {
    return prisma.professional.findMany({
      where: { isActive: true },
      include: { availability: true },
    })
  },

  async findById(id: string) {
    return prisma.professional.findUnique({
      where: { id, isActive: true },
      include: { availability: true },
    })
  },
}
