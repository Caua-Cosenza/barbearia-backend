import { describe, it, expect } from 'vitest'
import { CreateAppointmentSchema } from '../../src/dtos/requests/CreateAppointmentDto'

describe('CreateAppointmentSchema', () => {
  const valid = {
    professionalId: '00000000-0000-0000-0000-000000000001',
    serviceId: '00000000-0000-0000-0000-000000000002',
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  }

  it('accepts valid input', () => {
    expect(() => CreateAppointmentSchema.parse(valid)).not.toThrow()
  })

  it('rejects amount field (price manipulation protection)', () => {
    expect(() => CreateAppointmentSchema.parse({ ...valid, amount: 999 })).toThrow()
  })

  it('rejects price field', () => {
    expect(() => CreateAppointmentSchema.parse({ ...valid, price: 1 })).toThrow()
  })

  it('rejects invalid uuid', () => {
    expect(() => CreateAppointmentSchema.parse({ ...valid, professionalId: 'not-a-uuid' })).toThrow()
  })

  it('rejects invalid datetime', () => {
    expect(() => CreateAppointmentSchema.parse({ ...valid, scheduledAt: 'not-a-date' })).toThrow()
  })
})
