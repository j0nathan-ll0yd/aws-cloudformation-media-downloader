import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {testContext} from '../../../util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../types/main'
const fakeUserId = uuidv4()
const fakeUserDevicesResponse = {
  Items: [
    {
      devices: new Set(['67C431DE-37D2-4BBA-9055-E9D2766517E1', 'C51C57D9-8898-4584-94D8-81D49B21EB2A']),
      userId: fakeUserId
    }
  ]
}
const fakeDeviceResponse1 = {
  Items: [
    {
      deviceId: '67C431DE-37D2-4BBA-9055-E9D2766517E1',
      token: 'fake-token',
      systemName: 'iOS',
      endpointArn: 'fake-endpointArn',
      systemVersion: '16.0.2',
      name: 'iPhone'
    }
  ]
}

const fakeDeviceResponse2 = {
  Items: [
    {
      deviceId: 'C51C57D9-8898-4584-94D8-81D49B21EB2A',
      token: 'fake-token',
      systemName: 'iOS',
      endpointArn: 'fake-endpointArn',
      systemVersion: '16.0.2',
      name: 'iPhone'
    }
  ]
}

const fakeGithubIssueResponse = {
  status: '201',
  url: 'https://api.github.com/repos/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues',
  headers: {},
  data: {
    id: 1679634750,
    number: 57,
    title: 'UserDelete Failed for UserId: 0f2e90e6-3c52-4d48-a6f2-5119446765f1'
  }
}

const queryMock = jest.fn()
const deleteItemMock = jest.fn().mockReturnValue({})
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  updateItem: jest.fn().mockReturnValue({}),
  deleteItem: deleteItemMock,
  query: queryMock,
  scan: jest.fn()
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/SNS', () => ({
  deleteEndpoint: jest.fn().mockReturnValue({
    ResponseMetadata: {
      RequestId: uuidv4()
    }
  }),
  subscribe: jest.fn()
}))

jest.unstable_mockModule('../../../util/github-helpers', () => ({
  createFailedUserDeletionIssue: jest.fn().mockReturnValue(fakeGithubIssueResponse)
}))

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#UserDelete', () => {
  let event: CustomAPIGatewayRequestAuthorizerEvent
  const context = testContext
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    event.requestContext.authorizer!.principalId = fakeUserId
  })
  test('should delete all user data', async () => {
    queryMock.mockReturnValueOnce(fakeUserDevicesResponse)
    queryMock.mockReturnValueOnce(fakeDeviceResponse1)
    queryMock.mockReturnValueOnce(fakeDeviceResponse2)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
  })
  test('should create an issue if deletion fails', async () => {
    deleteItemMock.mockImplementationOnce(() => {
      throw new Error('Delete failed')
    })
    queryMock.mockReturnValueOnce(fakeUserDevicesResponse)
    queryMock.mockReturnValueOnce(fakeDeviceResponse1)
    queryMock.mockReturnValueOnce(fakeDeviceResponse2)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)
  })
  describe('#AWSFailure', () => {
    test('AWS.DynamoDB.query.0', async () => {
      queryMock.mockReturnValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
    test('AWS.DynamoDB.query.1', async () => {
      queryMock.mockReturnValueOnce(fakeUserDevicesResponse)
      queryMock.mockReturnValueOnce({})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
    test('AWS.ApiGateway.CustomLambdaAuthorizer', async () => {
      event.requestContext.authorizer!.principalId = 'unknown'
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })
  })
})
