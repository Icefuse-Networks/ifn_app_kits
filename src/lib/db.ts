/**
 * Prisma Database Client
 *
 * Singleton pattern to prevent multiple Prisma instances during development.
 * Includes utilities for JSON serialization of BigInt values.
 *
 * DATABASE_URL is sourced from the centralized config (src/config/index.ts)
 * and bridged to process.env for Prisma's schema.prisma env("DATABASE_URL").
 */

import { PrismaClient } from '@prisma/client'
import { databaseConfig } from '@/config'

// Bridge centralized config to process.env for Prisma
process.env.DATABASE_URL = databaseConfig.url

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

/**
 * Serialize Prisma data for JSON response
 * Handles BigInt conversion to Number
 */
export function serializePrisma<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
  )
}

/**
 * Get client IP from request headers
 * Checks X-Forwarded-For, X-Real-IP, then falls back to connection IP
 */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return null
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent')
}
