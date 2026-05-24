export const RATE_LIMITS = {
  PUBLIC: { max: 30, window: '1 minute' },
  BOOKING: { max: 10, window: '1 minute' },
  AUTH: { max: 5, window: '1 minute' },
} as const

export const TOKEN_EXPIRY = {
  ACCESS: '15m',
  REFRESH: '7d',
  REFRESH_REDIS_SECONDS: 60 * 60 * 24 * 7, // 7 days in seconds
} as const

export const PASSWORD_HASH_ROUNDS = 12

export const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
