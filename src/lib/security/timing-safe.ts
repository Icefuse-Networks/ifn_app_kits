/**
 * Timing-Safe Comparison Utilities
 *
 * SECURITY: Always use these functions when comparing secrets, tokens, or signatures.
 */

import { timingSafeEqual, randomBytes } from 'crypto'

/**
 * Secure timing-safe token comparison
 */
export function secureTokenCompare(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) {
    const dummy = randomBytes(expected.length).toString('hex').slice(0, expected.length)
    try {
      timingSafeEqual(Buffer.from(dummy, 'utf8'), Buffer.from(expected, 'utf8'))
    } catch {
      // Ignore - just ensuring constant time
    }
    return false
  }

  try {
    return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'))
  } catch {
    return false
  }
}

/**
 * Simple timing-safe comparison
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/**
 * Safe comparison with null/empty checks
 */
export function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false

  try {
    const bufA = Buffer.from(a, 'utf8')
    const bufB = Buffer.from(b, 'utf8')

    if (bufA.length !== bufB.length) {
      timingSafeEqual(bufA, bufA)
      return false
    }

    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}
