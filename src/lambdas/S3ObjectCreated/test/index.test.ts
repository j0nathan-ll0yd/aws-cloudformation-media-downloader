import {describe, expect, test, jest} from '@jest/globals'
import {S3Event} from 'aws-lambda'
import {testContext} from '../../../util/jest-setup'

const filesScanGoMock = jest.fn<() => Promise<{data: unknown}>>()
const filesScanWhereMock = jest.fn(() => ({go: filesScanGoMock}))
jest.unstable_mockModule('../../../lib/vendor/ElectroDB/entities/Files', () => ({
  Files: {
    scan: {
      where: filesScanWhereMock,
      go: jest.fn()
    }
  }
}))

const userFilesScanGoMock = jest.fn<() => Promise<{data: unknown}>>()
jest.unstable_mockModule('../../../lib/vendor/ElectroDB/entities/UserFiles', () => ({
  UserFiles: {
    scan: {
      go: userFilesScanGoMock
    }
  }
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
    filesScanGoMock.mockResolvedValue({data: getFileByKeyResponse.Items})
    const {default: getUsersByFileIdResponse} = await import('./fixtures/getUsersByFileId-200-OK.json', {assert: {type: 'json'}})
    userFilesScanGoMock.mockResolvedValue({data: getUsersByFileIdResponse.Items})
    const output = await handler(event, testContext)
    expect(output).toBeUndefined()
  })
  test('should throw an error if the file does not exist', async () => {
    filesScanGoMock.mockResolvedValue({data: []})
    await expect(handler(event, testContext)).rejects.toThrow(Error)
  })
})
