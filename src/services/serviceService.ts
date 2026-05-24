import { serviceRepository } from '../repositories/serviceRepository'

export const serviceService = {
  async listAll() {
    // amountCents is NOT returned — price shown only on confirmation
    return serviceRepository.findAll()
  },

  async findById(id: string) {
    const service = await serviceRepository.findById(id)
    if (!service) throw Object.assign(new Error('Service not found'), { statusCode: 404 })
    // Strip amountCents from public response
    const { amountCents: _amount, ...publicData } = service
    return publicData
  },
}
