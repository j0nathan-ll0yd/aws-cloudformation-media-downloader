import {beforeEach, describe, expect, test} from '@jest/globals'
import {APIGatewayEvent} from 'aws-lambda'
import {testContext} from '#util/jest-setup'

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})

const {handler} = await import('./../src')

describe('#LogClientEvent', () => {
  const context = testContext
  let event: APIGatewayEvent

  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
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
})
