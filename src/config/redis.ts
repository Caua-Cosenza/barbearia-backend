import Redis from 'ioredis'
import { env } from './env'
import { logger } from '../utils/logger'

export const redisClient = new Redis(env.REDIS_URL, {
  password: env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 3) return null
    return Math.min(times * 200, 2000)
  },
})

redisClient.on('connect', () => logger.info('Redis connected'))
redisClient.on('error', (err) => logger.error(err, 'Redis error'))

redisClient.connect().catch((err) => {
  logger.error(err, 'Failed to connect to Redis')
  process.exit(1)
})
