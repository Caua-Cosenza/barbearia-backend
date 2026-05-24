import { z } from 'zod'

export const LoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict()

export type LoginDto = z.infer<typeof LoginSchema>
