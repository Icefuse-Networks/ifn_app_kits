/**
 * Icefuse Kit Manager - Centralized Logging Utility
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none'

interface LoggingConfig {
  level: LogLevel
  enabledModules: Set<string>
  includeTimestamp: boolean
  includeRequestId: boolean
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 99,
}

const config: LoggingConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  enabledModules: new Set(
    process.env.LOG_MODULES?.split(',').map(m => m.trim()) || [
      'auth',
      'session',
      'jwt',
      'callback',
      'kits',
      'admin',
    ]
  ),
  includeTimestamp: process.env.NODE_ENV === 'production',
  includeRequestId: true,
}

function shouldLog(level: LogLevel, module: string): boolean {
  if (LOG_LEVELS[level] < LOG_LEVELS[config.level]) {
    return false
  }

  if (config.enabledModules.size > 0 && !config.enabledModules.has(module)) {
    return false
  }

  return true
}

function formatPrefix(module: string, requestId?: string): string {
  const parts: string[] = []

  if (config.includeTimestamp) {
    parts.push(new Date().toISOString())
  }

  parts.push(`[${module.toUpperCase()}]`)

  if (config.includeRequestId && requestId) {
    parts.push(`[${requestId}]`)
  }

  return parts.join(' ')
}

function createModuleLogger(module: string) {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (!shouldLog('debug', module)) return
      const prefix = formatPrefix(module)
      if (data) {
        console.debug(prefix, message, JSON.stringify(data))
      } else {
        console.debug(prefix, message)
      }
    },

    info(message: string, data?: Record<string, unknown>) {
      if (!shouldLog('info', module)) return
      const prefix = formatPrefix(module)
      if (data) {
        console.log(prefix, message, JSON.stringify(data))
      } else {
        console.log(prefix, message)
      }
    },

    warn(message: string, data?: Record<string, unknown> | Error) {
      if (!shouldLog('warn', module)) return
      const prefix = formatPrefix(module)
      if (data instanceof Error) {
        console.warn(prefix, message, data.message)
      } else if (data) {
        console.warn(prefix, message, JSON.stringify(data))
      } else {
        console.warn(prefix, message)
      }
    },

    error(message: string, error?: Error | Record<string, unknown>) {
      if (!shouldLog('error', module)) return
      const prefix = formatPrefix(module)
      if (error instanceof Error) {
        console.error(prefix, message, error.message, error.stack)
      } else if (error) {
        console.error(prefix, message, JSON.stringify(error))
      } else {
        console.error(prefix, message)
      }
    },

    withRequestId(requestId: string) {
      const scopedModule = module
      return {
        debug(message: string, data?: Record<string, unknown>) {
          if (!shouldLog('debug', scopedModule)) return
          const prefix = formatPrefix(scopedModule, requestId)
          if (data) {
            console.debug(prefix, message, JSON.stringify(data))
          } else {
            console.debug(prefix, message)
          }
        },
        info(message: string, data?: Record<string, unknown>) {
          if (!shouldLog('info', scopedModule)) return
          const prefix = formatPrefix(scopedModule, requestId)
          if (data) {
            console.log(prefix, message, JSON.stringify(data))
          } else {
            console.log(prefix, message)
          }
        },
        warn(message: string, data?: Record<string, unknown> | Error) {
          if (!shouldLog('warn', scopedModule)) return
          const prefix = formatPrefix(scopedModule, requestId)
          if (data instanceof Error) {
            console.warn(prefix, message, data.message)
          } else if (data) {
            console.warn(prefix, message, JSON.stringify(data))
          } else {
            console.warn(prefix, message)
          }
        },
        error(message: string, error?: Error | Record<string, unknown>) {
          if (!shouldLog('error', scopedModule)) return
          const prefix = formatPrefix(scopedModule, requestId)
          if (error instanceof Error) {
            console.error(prefix, message, error.message, error.stack)
          } else if (error) {
            console.error(prefix, message, JSON.stringify(error))
          } else {
            console.error(prefix, message)
          }
        },
      }
    },
  }
}

export const logger = {
  auth: createModuleLogger('auth'),
  jwt: createModuleLogger('jwt'),
  session: createModuleLogger('session'),
  callback: createModuleLogger('callback'),
  kits: createModuleLogger('kits'),
  admin: createModuleLogger('admin'),
  analytics: createModuleLogger('analytics'),
  stats: createModuleLogger('stats'),
  shop: createModuleLogger('shop'),
  log: createModuleLogger('app'),
}

export function configureLogging(updates: Partial<{
  level: LogLevel
  modules: string[]
  includeTimestamp: boolean
  includeRequestId: boolean
}>) {
  if (updates.level) {
    config.level = updates.level
  }
  if (updates.modules) {
    config.enabledModules = new Set(updates.modules)
  }
  if (typeof updates.includeTimestamp === 'boolean') {
    config.includeTimestamp = updates.includeTimestamp
  }
  if (typeof updates.includeRequestId === 'boolean') {
    config.includeRequestId = updates.includeRequestId
  }
}

export function disableLogging() {
  config.level = 'none'
}

export function enableDebugLogging() {
  config.level = 'debug'
  config.enabledModules = new Set()
}

export function getLoggingConfig(): Readonly<LoggingConfig> {
  return {
    ...config,
    enabledModules: new Set(config.enabledModules),
  }
}
