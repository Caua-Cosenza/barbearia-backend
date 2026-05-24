import { z } from 'zod'

// amount/price MUST NOT come from client — fetched from DB in service layer
export const CreateAppointmentSchema = z.object({
  professionalId: z.string().uuid('Invalid professional ID'),
  serviceId: z.string().uuid('Invalid service ID'),
  scheduledAt: z.string().datetime({ offset: true, message: 'Invalid datetime format' }),
  notes: z.string().max(500).optional(),
})
  .strict() // rejects any extra fields (including amount, price, value)

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>

// Public (guest) booking — supports multiple services, no auth required
export const createPublicAppointmentSchema = z.object({
  professionalId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1, 'Selecione ao menos um serviço'),
  scheduledAt: z.string().datetime({ offset: true }).refine(
    (v) => new Date(v) > new Date(),
    { message: 'Data deve ser no futuro' },
  ),
  guestName: z.string().min(2).max(100),
  guestPhone: z.string().regex(/^\d{10,15}$/, 'Telefone deve conter apenas dígitos (10-15)'),
  guestEmail: z.string().email().optional(),
  notes: z.string().max(500).optional(),
}).strict()

export type CreatePublicAppointmentDto = z.infer<typeof createPublicAppointmentSchema>
