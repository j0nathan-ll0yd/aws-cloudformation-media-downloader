import {afterEach, beforeEach, describe, expect, it, type MockInstance, vi} from 'vitest'
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import {logger, metrics} from '#lib/vendor/Powertools'

vi.mock('#lib/vendor/OpenTelemetry', () => ({startSpan: vi.fn(() => null), endSpan: vi.fn(), addAnnotation: vi.fn(), addMetadata: vi.fn()}))

describe('Lambda:Handlers:BaseHandler', () => {
  let loggerInfoSpy: MockInstance<typeof logger.info>
  let loggerErrorSpy: MockInstance<typeof logger.error>
  let loggerAddContextSpy: MockInstance<typeof logger.addContext>
  let loggerAppendKeysSpy: MockInstance<typeof logger.appendKeys>
  let metricsAddMetricSpy: MockInstance<typeof metrics.addMetric>
  let metricsPublishSpy: MockInstance<typeof metrics.publishStoredMetrics>
  let originalLogLevel: string | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined)
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    loggerAddContextSpy = vi.spyOn(logger, 'addContext').mockImplementation(() => undefined)
    loggerAppendKeysSpy = vi.spyOn(logger, 'appendKeys').mockImplementation(() => undefined)
    metricsAddMetricSpy = vi.spyOn(metrics, 'addMetric').mockImplementation(() => undefined)
    metricsPublishSpy = vi.spyOn(metrics, 'publishStoredMetrics').mockImplementation(() => undefined)
    originalLogLevel = process.env.LOG_LEVEL
    process.env.LOG_LEVEL = 'INFO'
  })

  afterEach(() => {
    loggerInfoSpy.mockRestore()
    loggerErrorSpy.mockRestore()
    loggerAddContextSpy.mockRestore()
    loggerAppendKeysSpy.mockRestore()
    metricsAddMetricSpy.mockRestore()
    metricsPublishSpy.mockRestore()
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL
    } else {
      process.env.LOG_LEVEL = originalLogLevel
    }
  })

  const mockContext = {awsRequestId: 'test-request-id', functionName: 'TestHandler'} as Context

  describe('BaseHandler', () => {
    it('should emit Attempt metric on handler invocation', async () => {
      const {BaseHandler} = await import('../BaseHandler')

      class TestHandler extends BaseHandler<unknown, APIGatewayProxyResult> {
        readonly operationName = 'TestOp'
        protected async execute(): Promise<APIGatewayProxyResult> {
          return {statusCode: 200, body: '{}'}
        }
      }

      const handler = new TestHandler()
      await handler.handler({}, mockContext)

      expect(metricsAddMetricSpy).toHaveBeenCalledWith('TestOpAttempt', 'Count', 1)
    })

    it('should emit Success metric on successful execution', async () => {
      const {BaseHandler} = await import('../BaseHandler')

      class TestHandler extends BaseHandler<unknown, APIGatewayProxyResult> {
        readonly operationName = 'TestOp'
        protected async execute(): Promise<APIGatewayProxyResult> {
          return {statusCode: 200, body: '{}'}
        }
      }

      const handler = new TestHandler()
      await handler.handler({}, mockContext)

      expect(metricsAddMetricSpy).toHaveBeenCalledWith('TestOpSuccess', 'Count', 1)
    })

    it('should log handler invocation', async () => {
      const {BaseHandler} = await import('../BaseHandler')

      class TestHandler extends BaseHandler<unknown, APIGatewayProxyResult> {
        readonly operationName = 'TestOp'
        protected async execute(): Promise<APIGatewayProxyResult> {
          return {statusCode: 200, body: '{}'}
        }
      }

      const handler = new TestHandler()
      await handler.handler({}, mockContext)

      expect(loggerInfoSpy).toHaveBeenCalledWith('Handler invoked', {operationName: 'TestOp'})
    })

    it('should inject Lambda context into logger', async () => {
      const {BaseHandler} = await import('../BaseHandler')

      class TestHandler extends BaseHandler<unknown, APIGatewayProxyResult> {
        readonly operationName = 'TestOp'
        protected async execute(): Promise<APIGatewayProxyResult> {
          return {statusCode: 200, body: '{}'}
        }
      }

      const handler = new TestHandler()
      await handler.handler({}, mockContext)

      expect(loggerAddContextSpy).toHaveBeenCalledWith(mockContext)
    })

    it('should append operationName to logger keys', async () => {
      const {BaseHandler} = await import('../BaseHandler')

      class TestHandler extends BaseHandler<unknown, APIGatewayProxyResult> {
        readonly operationName = 'TestOp'
        protected async execute(): Promise<APIGatewayProxyResult> {
          return {statusCode: 200, body: '{}'}
        }
      }

      const handler = new TestHandler()
      await handler.handler({}, mockContext)

      expect(loggerAppendKeysSpy).toHaveBeenCalledWith({operationName: 'TestOp'})
    })

    it('should publish metrics after handler execution', async () => {
      const {BaseHandler} = await import('../BaseHandler')

      class TestHandler extends BaseHandler<unknown, APIGatewayProxyResult> {
        readonly operationName = 'TestOp'
        protected async execute(): Promise<APIGatewayProxyResult> {
          return {statusCode: 200, body: '{}'}
        }
      }

      const handler = new TestHandler()
      await handler.handler({}, mockContext)

      expect(metricsPublishSpy).toHaveBeenCalled()
    })

    it('should log error and rethrow on handler failure', async () => {
      const {BaseHandler} = await import('../BaseHandler')
      const testError = new Error('Test error')

      class TestHandler extends BaseHandler<unknown, APIGatewayProxyResult> {
        readonly operationName = 'TestOp'
        protected async execute(): Promise<APIGatewayProxyResult> {
          throw testError
        }
      }

      const handler = new TestHandler()

      await expect(handler.handler({}, mockContext)).rejects.toThrow('Test error')
      expect(loggerErrorSpy).toHaveBeenCalledWith('Handler failed', {error: testError, operationName: 'TestOp'})
    })

    it('should publish metrics even on error', async () => {
      const {BaseHandler} = await import('../BaseHandler')

      class TestHandler extends BaseHandler<unknown, APIGatewayProxyResult> {
        readonly operationName = 'TestOp'
        protected async execute(): Promise<APIGatewayProxyResult> {
          throw new Error('Test error')
        }
      }

      const handler = new TestHandler()

      try {
        await handler.handler({}, mockContext)
      } catch {
        // Expected to throw
      }

      expect(metricsPublishSpy).toHaveBeenCalled()
    })
  })

  describe('Traced decorator', () => {
    it('should start and end span on success', async () => {
      const {startSpan, endSpan} = await import('#lib/vendor/OpenTelemetry')
      const {BaseHandler} = await import('../BaseHandler')

      class TestHandler extends BaseHandler<unknown, APIGatewayProxyResult> {
        readonly operationName = 'TestOp'
        protected async execute(): Promise<APIGatewayProxyResult> {
          return {statusCode: 200, body: '{}'}
        }
      }

      const handler = new TestHandler()
      await handler.handler({}, mockContext)

      expect(startSpan).toHaveBeenCalledWith('test-op')
      expect(endSpan).toHaveBeenCalledWith(null) // span is null in mocked version
    })

    it('should end span with error on failure', async () => {
      const {endSpan} = await import('#lib/vendor/OpenTelemetry')
      const {BaseHandler} = await import('../BaseHandler')
      const testError = new Error('Test error')

      class TestHandler extends BaseHandler<unknown, APIGatewayProxyResult> {
        readonly operationName = 'TestOp'
        protected async execute(): Promise<APIGatewayProxyResult> {
          throw testError
        }
      }

      const handler = new TestHandler()

      try {
        await handler.handler({}, mockContext)
      } catch {
        // Expected to throw
      }

      expect(endSpan).toHaveBeenCalledWith(null, testError)
    })
  })
})
