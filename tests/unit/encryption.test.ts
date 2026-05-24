import { describe, it, expect } from 'vitest'

// Unit tests for encryption — mock env before importing
process.env.ENCRYPTION_KEY = 'a'.repeat(64)
process.env.JWT_SECRET = 'b'.repeat(32)
process.env.JWT_REFRESH_SECRET = 'c'.repeat(32)
process.env.DATABASE_URL = 'postgresql://x:y@localhost/test'
process.env.REDIS_URL = 'redis://localhost'
process.env.CORS_ORIGIN = 'http://localhost:5173'

const { encrypt, decrypt } = await import('../../src/utils/encryption')

describe('encryption', () => {
  it('round-trips plaintext', () => {
    const plain = 'João da Silva'
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it('produces different ciphertext each call (random IV)', () => {
    const plain = 'test'
    expect(encrypt(plain)).not.toBe(encrypt(plain))
  })

  it('throws on malformed ciphertext', () => {
    expect(() => decrypt('bad')).toThrow()
  })
})
