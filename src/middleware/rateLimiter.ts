// Route-level config for stricter limits
export const bookingRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
    },
  },
}

export const authRateLimit = {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute',
    },
  },
}
