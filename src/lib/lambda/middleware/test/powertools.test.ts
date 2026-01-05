/**
 * Unit tests for Powertools Middleware
 *
 * Tests the withPowertools wrapper with auto-detection metrics.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

// Mock dependencies BEFORE importing
vi.mock('#lib/vendor/Powertools',
  () => ({
    injectLambdaContext: vi.fn(() => ({id: 'inject-context-middleware'})),
    logger: {appendKeys: vi.fn()},
    metrics: {addMetric: vi.fn(), publishStoredMetrics: vi.fn(), hasStoredMetrics: vi.fn()},
    MetricUnit: {Count: 'Count'}
  }))

vi.mock('#lib/system/env', () => ({getOptionalEnv: vi.fn()}))

vi.mock('@middy/core', () => ({
  default: vi.fn((handler) => {
    const middlewares: Array<{before?: () => Promise<void>; after?: () => Promise<void>; onError?: () => Promise<void>}> = []
    const mockMiddy = {
      use: vi.fn((middleware) => {
        middlewares.push(middleware)
        return mockMiddy
      }),
      before: vi.fn((fn) => {
        middlewares.push({before: fn})
        return mockMiddy
      }),
      after: vi.fn((fn) => {
        middlewares.push({after: fn})
        return mockMiddy
      }),
      onError: vi.fn((fn) => {
        middlewares.push({onError: fn})
        return mockMiddy
      }),
      _handler: handler,
      _middlewares: middlewares
    }
    return mockMiddy
  })
}))

type MiddlewareHooks = {before?: () => Promise<void>; after?: () => Promise<void>; onError?: () => Promise<void>}

// Fresh import for each test
async function importPowertools() {
  vi.resetModules()
  // Re-mock after reset
  vi.mock('#lib/vendor/Powertools',
    () => ({
      injectLambdaContext: vi.fn(() => ({id: 'inject-context-middleware'})),
      logger: {appendKeys: vi.fn()},
      metrics: {addMetric: vi.fn(), publishStoredMetrics: vi.fn(), hasStoredMetrics: vi.fn()},
      MetricUnit: {Count: 'Count'}
    }))
  vi.mock('#lib/system/env', () => ({getOptionalEnv: vi.fn()}))
  vi.mock('@middy/core', () => ({
    default: vi.fn((handler) => {
      const middlewares: Array<MiddlewareHooks> = []
      const mockMiddy = {
        use: vi.fn((middleware) => {
          middlewares.push(middleware)
          return mockMiddy
        }),
        before: vi.fn((fn) => {
          middlewares.push({before: fn})
          return mockMiddy
        }),
        after: vi.fn((fn) => {
          middlewares.push({after: fn})
          return mockMiddy
        }),
        onError: vi.fn((fn) => {
          middlewares.push({onError: fn})
          return mockMiddy
        }),
        _handler: handler,
        _middlewares: middlewares
      }
      return mockMiddy
    })
  }))
  return await import('../powertools')
}

describe('Powertools Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('withPowertools', () => {
    it('should wrap handler with injectLambdaContext middleware', async () => {
      const {withPowertools} = await importPowertools()
      const handler = vi.fn().mockResolvedValue('result')

      const wrapped = withPowertools(handler)

      expect(wrapped).toBeDefined()
      expect(typeof wrapped).toBe('object') // Middy returns an object
    })

    it('should add before middleware for cold start tracking', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('development')

      const handler = vi.fn().mockResolvedValue('result')
      const wrapped = withPowertools(handler) as unknown as {_middlewares: MiddlewareHooks[]}

      // Should have a before middleware for cold start
      const beforeMiddleware = wrapped._middlewares.find((m) => m.before)
      expect(beforeMiddleware).toBeDefined()
    })

    it('should add after and onError middleware in non-test environment', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('production')

      const handler = vi.fn().mockResolvedValue('result')
      const wrapped = withPowertools(handler) as unknown as {_middlewares: MiddlewareHooks[]}

      // In production: should have 2 after and 2 onError middlewares
      // (securityHeaders + our metrics publishing)
      const afterMiddlewares = wrapped._middlewares.filter((m) => m.after)
      const onErrorMiddlewares = wrapped._middlewares.filter((m) => m.onError)
      expect(afterMiddlewares).toHaveLength(2)
      expect(onErrorMiddlewares).toHaveLength(2)
    })

    it('should NOT add metrics after/onError middleware in test environment', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('test')

      const handler = vi.fn().mockResolvedValue('result')
      const wrapped = withPowertools(handler) as unknown as {_middlewares: MiddlewareHooks[]}

      // In test env: securityHeaders has after/onError, but our metrics middleware should NOT be added
      // So we should have exactly 1 after and 1 onError (from securityHeaders only)
      const afterMiddlewares = wrapped._middlewares.filter((m) => m.after)
      const onErrorMiddlewares = wrapped._middlewares.filter((m) => m.onError)
      expect(afterMiddlewares).toHaveLength(1) // securityHeaders only
      expect(onErrorMiddlewares).toHaveLength(1) // securityHeaders only
    })
  })

  describe('cold start tracking', () => {
    it('should add cold start metric on first invocation', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('development')

      // Cold start metrics require LOG_LEVEL to not be SILENT
      const originalLogLevel = process.env.LOG_LEVEL
      process.env.LOG_LEVEL = 'INFO'

      try {
        const handler = vi.fn().mockResolvedValue('result')
        const wrapped = withPowertools(handler) as unknown as {_middlewares: MiddlewareHooks[]}

        // Find the before middleware (cold start tracking)
        const beforeMiddleware = wrapped._middlewares.find((m) => m.before)
        expect(beforeMiddleware).toBeDefined()

        // Execute the before middleware to trigger cold start
        const {metrics} = await import('#lib/vendor/Powertools')
        if (beforeMiddleware?.before) {
          await beforeMiddleware.before()
        }

        // Cold start metric should be added (publishing happens in after hook)
        expect(metrics.addMetric).toHaveBeenCalledWith('ColdStart', 'Count', 1)
      } finally {
        // Restore original LOG_LEVEL
        if (originalLogLevel !== undefined) {
          process.env.LOG_LEVEL = originalLogLevel
        } else {
          delete process.env.LOG_LEVEL
        }
      }
    })

    it('should skip cold start metrics when LOG_LEVEL is SILENT', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('development')

      // Set LOG_LEVEL to SILENT (as used in integration tests)
      const originalLogLevel = process.env.LOG_LEVEL
      process.env.LOG_LEVEL = 'SILENT'

      try {
        const handler = vi.fn().mockResolvedValue('result')
        const wrapped = withPowertools(handler) as unknown as {_middlewares: MiddlewareHooks[]}

        // Find the before middleware (cold start tracking)
        const beforeMiddleware = wrapped._middlewares.find((m) => m.before)
        expect(beforeMiddleware).toBeDefined()

        // Execute the before middleware
        const {metrics} = await import('#lib/vendor/Powertools')
        if (beforeMiddleware?.before) {
          await beforeMiddleware.before()
        }

        // Metrics should NOT be called when SILENT
        expect(metrics.addMetric).not.toHaveBeenCalled()
      } finally {
        // Restore original LOG_LEVEL
        if (originalLogLevel !== undefined) {
          process.env.LOG_LEVEL = originalLogLevel
        } else {
          delete process.env.LOG_LEVEL
        }
      }
    })
  })

  describe('auto-detection metrics publishing', () => {
    // Helper to find the LAST middleware with a given hook (ours, not securityHeaders)
    const findLastMiddleware = (middlewares: MiddlewareHooks[], hook: 'after' | 'onError') => {
      const matching = middlewares.filter((m) => m[hook])
      return matching[matching.length - 1]
    }

    it('should publish metrics in after hook when hasStoredMetrics returns true', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('production')

      const originalLogLevel = process.env.LOG_LEVEL
      process.env.LOG_LEVEL = 'INFO'

      try {
        const handler = vi.fn().mockResolvedValue('result')
        const wrapped = withPowertools(handler) as unknown as {_middlewares: MiddlewareHooks[]}

        const {metrics} = await import('#lib/vendor/Powertools')
        vi.mocked(metrics.hasStoredMetrics).mockReturnValue(true)

        // Find and execute the LAST after middleware (ours, not securityHeaders)
        const afterMiddleware = findLastMiddleware(wrapped._middlewares, 'after')
        expect(afterMiddleware).toBeDefined()
        if (afterMiddleware?.after) {
          await afterMiddleware.after()
        }

        expect(metrics.hasStoredMetrics).toHaveBeenCalled()
        expect(metrics.publishStoredMetrics).toHaveBeenCalled()
      } finally {
        if (originalLogLevel !== undefined) {
          process.env.LOG_LEVEL = originalLogLevel
        } else {
          delete process.env.LOG_LEVEL
        }
      }
    })

    it('should NOT publish metrics when hasStoredMetrics returns false', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('production')

      const originalLogLevel = process.env.LOG_LEVEL
      process.env.LOG_LEVEL = 'INFO'

      try {
        const handler = vi.fn().mockResolvedValue('result')
        const wrapped = withPowertools(handler) as unknown as {_middlewares: MiddlewareHooks[]}

        const {metrics} = await import('#lib/vendor/Powertools')
        vi.mocked(metrics.hasStoredMetrics).mockReturnValue(false)

        // Find and execute the LAST after middleware (ours, not securityHeaders)
        const afterMiddleware = findLastMiddleware(wrapped._middlewares, 'after')
        expect(afterMiddleware).toBeDefined()
        if (afterMiddleware?.after) {
          await afterMiddleware.after()
        }

        expect(metrics.hasStoredMetrics).toHaveBeenCalled()
        expect(metrics.publishStoredMetrics).not.toHaveBeenCalled()
      } finally {
        if (originalLogLevel !== undefined) {
          process.env.LOG_LEVEL = originalLogLevel
        } else {
          delete process.env.LOG_LEVEL
        }
      }
    })

    it('should publish metrics in onError hook when hasStoredMetrics returns true', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('production')

      const originalLogLevel = process.env.LOG_LEVEL
      process.env.LOG_LEVEL = 'INFO'

      try {
        const handler = vi.fn().mockResolvedValue('result')
        const wrapped = withPowertools(handler) as unknown as {_middlewares: MiddlewareHooks[]}

        const {metrics} = await import('#lib/vendor/Powertools')
        vi.mocked(metrics.hasStoredMetrics).mockReturnValue(true)

        // Find and execute the LAST onError middleware (ours, not securityHeaders)
        const onErrorMiddleware = findLastMiddleware(wrapped._middlewares, 'onError')
        expect(onErrorMiddleware).toBeDefined()
        if (onErrorMiddleware?.onError) {
          await onErrorMiddleware.onError()
        }

        expect(metrics.hasStoredMetrics).toHaveBeenCalled()
        expect(metrics.publishStoredMetrics).toHaveBeenCalled()
      } finally {
        if (originalLogLevel !== undefined) {
          process.env.LOG_LEVEL = originalLogLevel
        } else {
          delete process.env.LOG_LEVEL
        }
      }
    })

    it('should NOT publish metrics when LOG_LEVEL is SILENT', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('production')

      const originalLogLevel = process.env.LOG_LEVEL
      process.env.LOG_LEVEL = 'SILENT'

      try {
        const handler = vi.fn().mockResolvedValue('result')
        const wrapped = withPowertools(handler) as unknown as {_middlewares: MiddlewareHooks[]}

        const {metrics} = await import('#lib/vendor/Powertools')
        vi.mocked(metrics.hasStoredMetrics).mockReturnValue(true)

        // Find and execute the LAST after middleware (ours, not securityHeaders)
        const afterMiddleware = findLastMiddleware(wrapped._middlewares, 'after')
        expect(afterMiddleware).toBeDefined()
        if (afterMiddleware?.after) {
          await afterMiddleware.after()
        }

        // Should NOT publish even if metrics exist when SILENT
        expect(metrics.publishStoredMetrics).not.toHaveBeenCalled()
      } finally {
        if (originalLogLevel !== undefined) {
          process.env.LOG_LEVEL = originalLogLevel
        } else {
          delete process.env.LOG_LEVEL
        }
      }
    })
  })

  describe('exports', () => {
    it('should re-export logger, metrics, and MetricUnit', async () => {
      const powertools = await importPowertools()

      expect(powertools.logger).toBeDefined()
      expect(powertools.metrics).toBeDefined()
      expect(powertools.MetricUnit).toBeDefined()
    })
  })
})
