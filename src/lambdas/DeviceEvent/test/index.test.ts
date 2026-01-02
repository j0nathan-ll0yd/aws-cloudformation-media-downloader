import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {APIGatewayEvent} from 'aws-lambda'
import {testContext} from '#util/vitest-setup'
import {createAPIGatewayEvent} from '#test/helpers/event-factories'

// Mock the logging module to verify logging behavior
const logInfoMock = vi.fn()
vi.mock('#lib/system/logging', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#lib/system/logging')>()
  return {...actual, logInfo: logInfoMock}
})

const {handler} = await import('./../src')

describe('#LogClientEvent', () => {
  const context = testContext
  let event: APIGatewayEvent

  beforeEach(() => {
    vi.clearAllMocks()
    event = createAPIGatewayEvent({
      path: '/logClientEvent',
      httpMethod: 'POST',
      headers: {'x-device-uuid': 'test-device-uuid'}
    }) as unknown as APIGatewayEvent
  })

  test('should successfully log a client event and return 204', async () => {
    event.body = JSON.stringify({type: 'app_opened', timestamp: Date.now()})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
    // Verify logging was called with correct parameters
    expect(logInfoMock).toHaveBeenCalledWith('Event received', {deviceId: 'test-device-uuid', message: event.body})
  })

  test('should handle missing device UUID header', async () => {
    delete event.headers['x-device-uuid']
    event.body = JSON.stringify({type: 'test_event'})

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
    // Verify logging was called with undefined deviceId
    expect(logInfoMock).toHaveBeenCalledWith('Event received', {deviceId: undefined, message: event.body})
  })

  test('should handle null body', async () => {
    event.body = null

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
    // Verify logging was called with null message
    expect(logInfoMock).toHaveBeenCalledWith('Event received', {deviceId: 'test-device-uuid', message: null})
  })

  test('should handle empty body', async () => {
    event.body = ''

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
    // Verify logging was called with empty message
    expect(logInfoMock).toHaveBeenCalledWith('Event received', {deviceId: 'test-device-uuid', message: ''})
  })

  describe('#EdgeCases', () => {
    test('should handle invalid JSON body gracefully', async () => {
      event.body = 'not-valid-json{'

      const output = await handler(event, context)
      // Should not throw, just log and return 204
      expect(output.statusCode).toEqual(204)
    })

    test('should handle very large event payload', async () => {
      // Simulate a large event payload
      const largePayload = JSON.stringify({
        events: Array.from({length: 100}, (_, i) => ({type: 'test_event', timestamp: Date.now(), data: {index: i, content: 'x'.repeat(100)}}))
      })
      event.body = largePayload

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(204)
    })

    test('should handle event with unknown event type', async () => {
      event.body = JSON.stringify({type: 'unknown_event_type', data: {}})

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(204)
    })

    test('should handle missing required event fields', async () => {
      event.body = JSON.stringify({incomplete: true})

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(204)
    })

    test('should handle event with special characters in body', async () => {
      event.body = JSON.stringify({type: 'test_event', message: 'Special chars: \n\t\r "quotes" <html>'})

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(204)
    })
  })
})
