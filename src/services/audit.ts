/**
 * Audit Logging Service
 *
 * SECURITY: All mutations are logged for accountability and debugging.
 * Logs who did what, when, and what changed.
 */

import { prisma, getClientIp, getUserAgent } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { AuditAction, AuditResourceType, AuthContext } from '@/types/api'

// =============================================================================
// Types
// =============================================================================

export interface AuditLogParams {
  /** Action performed */
  action: AuditAction
  /** Type of resource affected */
  resourceType: AuditResourceType
  /** ID of the resource */
  resourceId: string
  /** Auth context (token or session info) */
  authContext: AuthContext
  /** Previous values (for update/delete) */
  oldValues?: unknown
  /** New values (for create/update) */
  newValues?: unknown
  /** Original request (for IP/UA extraction) */
  request?: Request
}

// =============================================================================
// Audit Logging
// =============================================================================

/**
 * Create an audit log entry
 *
 * @param params - Audit log parameters
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  const {
    action,
    resourceType,
    resourceId,
    authContext,
    oldValues,
    newValues,
    request,
  } = params

  try {
    await prisma.auditLog.create({
      data: {
        action,
        resourceType,
        resourceId,
        actorType: authContext.type,
        actorId: authContext.actorId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress: request ? getClientIp(request) : null,
        userAgent: request ? getUserAgent(request)?.slice(0, 255) : null,
      },
    })

    logger.admin.info('Audit log created', {
      action,
      resourceType,
      resourceId,
      actorType: authContext.type,
      actorId: authContext.actorId,
    })
  } catch (error) {
    // Log error but don't fail the main operation
    logger.admin.error('Failed to create audit log', error as Error)
  }
}

/**
 * Log a create action
 */
export async function auditCreate(
  resourceType: AuditResourceType,
  resourceId: string,
  authContext: AuthContext,
  newValues: unknown,
  request?: Request
): Promise<void> {
  await createAuditLog({
    action: 'create',
    resourceType,
    resourceId,
    authContext,
    newValues,
    request,
  })
}

/**
 * Log an update action
 */
export async function auditUpdate(
  resourceType: AuditResourceType,
  resourceId: string,
  authContext: AuthContext,
  oldValues: unknown,
  newValues: unknown,
  request?: Request
): Promise<void> {
  await createAuditLog({
    action: 'update',
    resourceType,
    resourceId,
    authContext,
    oldValues,
    newValues,
    request,
  })
}

/**
 * Log a delete action
 */
export async function auditDelete(
  resourceType: AuditResourceType,
  resourceId: string,
  authContext: AuthContext,
  oldValues: unknown,
  request?: Request
): Promise<void> {
  await createAuditLog({
    action: 'delete',
    resourceType,
    resourceId,
    authContext,
    oldValues,
    request,
  })
}

// =============================================================================
// Audit Log Queries
// =============================================================================

/**
 * Get recent audit logs
 */
export async function getRecentAuditLogs(limit: number = 50) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  })
}

/**
 * Get audit logs for a specific resource
 */
export async function getAuditLogsForResource(
  resourceType: AuditResourceType,
  resourceId: string,
  limit: number = 50
) {
  return prisma.auditLog.findMany({
    where: {
      resourceType,
      resourceId,
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  })
}

/**
 * Get audit logs by actor
 */
export async function getAuditLogsByActor(actorId: string, limit: number = 50) {
  return prisma.auditLog.findMany({
    where: { actorId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  })
}
