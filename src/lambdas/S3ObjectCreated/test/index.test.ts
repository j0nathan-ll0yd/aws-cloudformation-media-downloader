import {describe, expect, test, jest} from '@jest/globals'
import {S3Event} from 'aws-lambda'
import {testContext} from '../../../util/jest-setup'

const scanMock = jest.fn()
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  scan: scanMock
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/SQS', () => ({
  sendMessage: jest.fn()
}))

const {default: eventMock} = await import('./fixtures/Event.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#S3ObjectCreated', () => {
  const event = eventMock as S3Event
  test('should dispatch push notifications for each user with the file', async () => {
    const {default: getFileByKeyResponse} = await import('./fixtures/getFileByKey-200-OK.json', {assert: {type: 'json'}})
    scanMock.mockReturnValueOnce(getFileByKeyResponse)
    const {default: getUsersByFileIdResponse} = await import('./fixtures/getUsersByFileId-200-OK.json', {assert: {type: 'json'}})
    scanMock.mockReturnValueOnce(getUsersByFileIdResponse)
    const output = await handler(event, testContext)
    expect(output).toBeUndefined()
  })
  test('should throw an error if the file does not exist', async () => {
    scanMock.mockReturnValueOnce({Count: 0})
    await expect(handler(event, testContext)).rejects.toThrow(Error)
  })
})
