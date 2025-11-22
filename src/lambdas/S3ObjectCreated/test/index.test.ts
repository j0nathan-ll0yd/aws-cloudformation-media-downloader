import {describe, expect, test, jest} from '@jest/globals'
import {S3Event} from 'aws-lambda'
import {testContext} from '../../../util/jest-setup'

const filesQueryByKeyGoMock = jest.fn<() => Promise<{data: unknown}>>()
const filesQueryByKeyMock = jest.fn(() => ({go: filesQueryByKeyGoMock}))
jest.unstable_mockModule('../../../entities/Files', () => ({
  Files: {
    query: {
      byKey: filesQueryByKeyMock
    }
  }
}))

const userFilesQueryByFileGoMock = jest.fn<() => Promise<{data: unknown}>>()
const userFilesQueryByFileMock = jest.fn(() => ({go: userFilesQueryByFileGoMock}))
jest.unstable_mockModule('../../../entities/UserFiles', () => ({
  UserFiles: {
    query: {
      byFile: userFilesQueryByFileMock
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
    filesQueryByKeyGoMock.mockResolvedValue({data: getFileByKeyResponse.Items})
    const {default: getUsersByFileIdResponse} = await import('./fixtures/getUsersByFileId-200-OK.json', {assert: {type: 'json'}})
    userFilesQueryByFileGoMock.mockResolvedValue({data: getUsersByFileIdResponse.Items})
    const output = await handler(event, testContext)
    expect(output).toBeUndefined()
  })
  test('should throw an error if the file does not exist', async () => {
    filesQueryByKeyGoMock.mockResolvedValue({data: []})
    await expect(handler(event, testContext)).rejects.toThrow(Error)
  })
})
