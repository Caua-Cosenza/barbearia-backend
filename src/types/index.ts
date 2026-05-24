export type UserRole = 'CLIENT' | 'PROFESSIONAL' | 'ADMIN'

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data: T | null
  error: string | null
  message: string
  timestamp: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
