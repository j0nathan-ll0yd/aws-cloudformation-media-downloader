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
  test('(anonymous) should list only the default file', async () => {
    delete event.headers['X-User-Id']
    delete event.headers['Authorization']
    const {default: batchGetResponse} = await import('./fixtures/batchGet-200-OK.json', {assert: {type: 'json'}})
    batchGetMock.mockReturnValue(batchGetResponse)
    queryMock.mockReturnValue(queryStubReturnObject)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(Object.keys(body.body)).toEqual(expect.arrayContaining(['keyCount', 'contents']))
    expect(body.body.keyCount).toEqual(1)
    expect(body.body.contents[0]).toHaveProperty('authorName')
    expect(body.body.contents[0].authorName).toEqual('Lifegames')
  })
  test('(authenticated) should return users files', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    const {default: batchGetResponse} = await import('./fixtures/batchGet-200-Filtered.json', {assert: {type: 'json'}})
    batchGetMock.mockReturnValue(batchGetResponse)
    queryMock.mockReturnValue(queryStubReturnObject)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(Object.keys(body.body)).toEqual(expect.arrayContaining(['keyCount', 'contents']))
    expect(body.body.keyCount).toEqual(1)
  })
  test('(authenticated) should gracefully handle an empty list', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    const {default: batchGetResponse} = await import('./fixtures/batchGet-200-Empty.json', {assert: {type: 'json'}})
    batchGetMock.mockReturnValue(batchGetResponse)
    const {default: queryResponse} = await import('./fixtures/query-200-Empty.json', {assert: {type: 'json'}})
    queryMock.mockReturnValue(queryResponse)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(Object.keys(body.body)).toEqual(expect.arrayContaining(['keyCount', 'contents']))
    expect(body.body.keyCount).toEqual(0)
  })
  test('should fail gracefully if query fails', async () => {
    queryMock.mockImplementation(() => {
      throw new Error()
    })
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
    const body = JSON.parse(output.body)
    expect(Object.keys(body)).toEqual(expect.arrayContaining(['error', 'requestId']))
  })
  test('(unauthenticated) should throw an error as token is invalid', async () => {
    delete event.headers['X-User-Id']
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
    const body = JSON.parse(output.body)
    expect(Object.keys(body)).toEqual(expect.arrayContaining(['error', 'requestId']))
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
