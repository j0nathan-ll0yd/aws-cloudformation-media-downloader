import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {SQSEvent} from 'aws-lambda'
import {UnexpectedError} from '../../../util/errors'
import {v4 as uuidv4} from 'uuid'
const fakeUserId = uuidv4()
const fakeDeviceId = uuidv4()
const getUserDevicesByUserIdResponse = {
  Items: [
    {
      devices: new Set([fakeDeviceId]),
      userId: fakeUserId
    }
  ],
  Count: 1,
  ScannedCount: 1
}

const queryMock = jest.fn()
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  query: queryMock
}))

const publishSnsEventMock = jest.fn()
jest.unstable_mockModule('../../../lib/vendor/AWS/SNS', () => ({
  publishSnsEvent: publishSnsEventMock
}))

const {default: eventMock} = await import('./fixtures/SQSEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#SendPushNotification', () => {
  let event: SQSEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock)) as SQSEvent
  })
  describe('#AWSFailure', () => {
    test('AWS.DynamoDB.DocumentClient.query.getUserDevicesByUserId', async () => {
      queryMock.mockReturnValue(undefined)
      await expect(handler(event)).rejects.toThrow(UnexpectedError)
    })
    test('AWS.DynamoDB.DocumentClient.query.getDevice', async () => {
      queryMock.mockReturnValueOnce(getUserDevicesByUserIdResponse)
      queryMock.mockReturnValueOnce(undefined)
      const notificationsSent = await handler(event)
      expect(notificationsSent).toBeUndefined()
      expect(publishSnsEventMock.mock.calls.length).toBe(0)
    })
  })
})
