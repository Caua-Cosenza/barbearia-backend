import { professionalRepository } from '../repositories/professionalRepository'
import { decrypt } from '../utils/encryption'

export const professionalService = {
  async listAll() {
    const professionals = await professionalRepository.findAll()
    return professionals.map((p) => ({
      id: p.id,
      name: decrypt(p.nameEncrypted),
      bio: p.bio,
      isWalkIn: p.isWalkIn,
      availability: p.availability.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
    }))
  },

  async findById(id: string) {
    const professional = await professionalRepository.findById(id)
    if (!professional) {
      throw Object.assign(new Error('Professional not found'), { statusCode: 404 })
    }
    return {
      id: professional.id,
      name: decrypt(professional.nameEncrypted),
      bio: professional.bio,
      isWalkIn: professional.isWalkIn,
      availability: professional.availability.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
    }
  },
}
