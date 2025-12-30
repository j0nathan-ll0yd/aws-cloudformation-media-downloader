/**
 * Unit tests for Powertools Middleware
 *
 * Tests the withPowertools wrapper and cold start tracking.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

// Mock dependencies BEFORE importing
vi.mock('#lib/vendor/Powertools',
  () => ({
    injectLambdaContext: vi.fn(() => ({id: 'inject-context-middleware'})),
    logger: {appendKeys: vi.fn()},
    logMetrics: vi.fn(() => ({id: 'log-metrics-middleware'})),
    metrics: {addMetric: vi.fn(), publishStoredMetrics: vi.fn()},
    MetricUnit: {Count: 'Count'}
  }))

vi.mock('#lib/system/env', () => ({getOptionalEnv: vi.fn()}))

vi.mock('@middy/core', () => ({
  default: vi.fn((handler) => {
    const middlewares: Array<{before?: () => Promise<void>}> = []
    const mockMiddy = {
      use: vi.fn((middleware) => {
        middlewares.push(middleware)
        return mockMiddy
      }),
      before: vi.fn((fn) => {
        middlewares.push({before: fn})
        return mockMiddy
      }),
      _handler: handler,
      _middlewares: middlewares
    }
    return mockMiddy
  })
}))

// Fresh import for each test
async function importPowertools() {
  vi.resetModules()
  // Re-mock after reset
  vi.mock('#lib/vendor/Powertools',
    () => ({
      injectLambdaContext: vi.fn(() => ({id: 'inject-context-middleware'})),
      logger: {appendKeys: vi.fn()},
      logMetrics: vi.fn(() => ({id: 'log-metrics-middleware'})),
      metrics: {addMetric: vi.fn(), publishStoredMetrics: vi.fn()},
      MetricUnit: {Count: 'Count'}
    }))
  vi.mock('#lib/system/env', () => ({getOptionalEnv: vi.fn()}))
  vi.mock('@middy/core', () => ({
    default: vi.fn((handler) => {
      const middlewares: Array<{before?: () => Promise<void>}> = []
      const mockMiddy = {
        use: vi.fn((middleware) => {
          middlewares.push(middleware)
          return mockMiddy
        }),
        before: vi.fn((fn) => {
          middlewares.push({before: fn})
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

    it('should use manual cold start tracking by default', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('development')

      const handler = vi.fn().mockResolvedValue('result')
      withPowertools(handler)

      // Should NOT call logMetrics for non-custom metrics
      const {logMetrics} = await import('#lib/vendor/Powertools')
      expect(logMetrics).not.toHaveBeenCalled()
    })

    it('should enable full metrics when enableCustomMetrics is true and not in test', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('production')

      const handler = vi.fn().mockResolvedValue('result')
      withPowertools(handler, {enableCustomMetrics: true})

      const {logMetrics} = await import('#lib/vendor/Powertools')
      expect(logMetrics).toHaveBeenCalled()
    })

    it('should NOT enable full metrics when in test environment', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('test')

      const handler = vi.fn().mockResolvedValue('result')
      withPowertools(handler, {enableCustomMetrics: true})

      const {logMetrics} = await import('#lib/vendor/Powertools')
      expect(logMetrics).not.toHaveBeenCalled()
    })
  })

  describe('cold start tracking', () => {
    it('should track cold start on first invocation', async () => {
      const {withPowertools} = await importPowertools()
      const {getOptionalEnv} = await import('#lib/system/env')
      vi.mocked(getOptionalEnv).mockReturnValue('development')

      const handler = vi.fn().mockResolvedValue('result')
      const wrapped = withPowertools(handler) as unknown as {_middlewares: Array<{before?: () => Promise<void>}>}

      // Find the before middleware (cold start tracking)
      const beforeMiddleware = wrapped._middlewares.find((m) => m.before)
      expect(beforeMiddleware).toBeDefined()

      // Execute the before middleware to trigger cold start
      const {metrics} = await import('#lib/vendor/Powertools')
      if (beforeMiddleware?.before) {
        await beforeMiddleware.before()
      }

      expect(metrics.addMetric).toHaveBeenCalledWith('ColdStart', 'Count', 1)
      expect(metrics.publishStoredMetrics).toHaveBeenCalled()
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
