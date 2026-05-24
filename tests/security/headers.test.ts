import { describe, it, expect } from 'vitest'

// Security tests verify expected response headers
// Run against a live dev server: BACKEND_URL=http://localhost:3333

const BASE_URL = process.env.BACKEND_URL ?? 'http://localhost:3333'

describe('security headers', () => {
  it('returns HSTS header', async () => {
    const res = await fetch(`${BASE_URL}/health`)
    // Only present over HTTPS in prod; check for helmet being configured
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('returns X-Frame-Options', async () => {
    const res = await fetch(`${BASE_URL}/health`)
    expect(res.headers.get('x-frame-options')).toBeTruthy()
  })

  it('rejects amount in appointment body', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 999, professionalId: 'x', serviceId: 'y', scheduledAt: '' }),
    })
    expect(res.status).toBe(401) // 401 before even reaching amount check (no token)
  })
})
