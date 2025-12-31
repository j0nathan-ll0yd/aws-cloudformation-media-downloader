import {beforeEach, describe, expect, test} from 'vitest'
import type {APIGatewayEvent} from 'aws-lambda'
import {testContext} from '#util/vitest-setup'
import {createAPIGatewayEvent} from '#test/helpers/event-factories'

const {handler} = await import('./../src')

describe('#LogClientEvent', () => {
  const context = testContext
  let event: APIGatewayEvent

  beforeEach(() => {
    event = createAPIGatewayEvent({
      path: '/logClientEvent',
      httpMethod: 'POST',
      headers: {'x-device-uuid': 'test-device-uuid'}
    }) as unknown as APIGatewayEvent
  })

  test('should successfully log a client event and return 204', async () => {
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
  })

  test('should handle missing device UUID header', async () => {
    delete event.headers['x-device-uuid']

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
  })

  test('should handle null body', async () => {
    event.body = null

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
  })

  test('should handle empty body', async () => {
    event.body = ''

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
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
