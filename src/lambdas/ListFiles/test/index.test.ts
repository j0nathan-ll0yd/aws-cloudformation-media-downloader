import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {testContext} from '../../../util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../types/main'

const fakeUserId = uuidv4()
const {default: queryStubReturnObject} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
if (Array.isArray(queryStubReturnObject.Items)) {
  queryStubReturnObject.Items[0].fileId = Array.from(new Set(queryStubReturnObject.Items[0].fileId))
}

const batchGetMock = jest.fn()
const queryMock = jest.fn()
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  batchGet: batchGetMock,
  query: queryMock
}))

const {handler} = await import('./../src')

describe('#ListFiles', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    process.env.DynamoDBTableFiles = 'Files'
    process.env.DynamoDBTableUserFiles = 'UserFiles'
  })
  describe('#AWSFailure', () => {
    test('AWS.DynamoDB.DocumentClient.query', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      queryMock.mockReturnValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(Object.keys(body)).toEqual(expect.arrayContaining(['error', 'requestId']))
    })
    test('AWS.DynamoDB.DocumentClient.batchGet', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      queryMock.mockReturnValue(queryStubReturnObject)
      batchGetMock.mockReturnValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(Object.keys(body)).toEqual(expect.arrayContaining(['error', 'requestId']))
    })
  })
})
