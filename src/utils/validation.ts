import { z } from 'zod'

export const uuidSchema = z.string().uuid()

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format')

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const dateSchema = z.string().datetime({ offset: true })

export function createApiResponse<T>(data: T, message = 'Success') {
  return {
    success: true,
    data,
    error: null,
    message,
    timestamp: new Date().toISOString(),
  }
}

export function createErrorResponse(error: string, message: string) {
  return {
    success: false,
    data: null,
    error,
    message,
    timestamp: new Date().toISOString(),
  }
}
