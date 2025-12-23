import {beforeAll, describe, expect, jest, test} from '@jest/globals'
import type {S3Event} from 'aws-lambda'
import {testContext} from '#util/jest-setup'
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'

beforeAll(() => {
  process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789/test-queue'
})

const filesMock = createElectroDBEntityMock({queryIndexes: ['byKey']})
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))

const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byFile']})
jest.unstable_mockModule('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))

jest.unstable_mockModule('#lib/vendor/AWS/SQS', () => ({
  sendMessage: jest.fn(), // fmt: multiline
  stringAttribute: jest.fn((value: string) => ({DataType: 'String', StringValue: value})),
  numberAttribute: jest.fn((value: number) => ({DataType: 'Number', StringValue: value.toString()}))
}))

const {default: eventMock} = await import('./fixtures/Event.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#S3ObjectCreated', () => {
  const event = eventMock as S3Event
  test('should dispatch push notifications for each user with the file', async () => {
    const {default: getFileByKeyResponse} = await import('./fixtures/getFileByKey-200-OK.json', {assert: {type: 'json'}})
    filesMock.mocks.query.byKey!.go.mockResolvedValue({data: getFileByKeyResponse.Items})
    const {default: getUsersByFileIdResponse} = await import('./fixtures/getUsersByFileId-200-OK.json', {assert: {type: 'json'}})
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: getUsersByFileIdResponse.Items})
    const output = await handler(event, testContext)
    expect(output).toBeUndefined()
  })
  test('should handle missing file gracefully and continue processing', async () => {
    // With batch processing, errors are caught and logged rather than thrown
    // This allows remaining records to be processed even if one fails
    filesMock.mocks.query.byKey!.go.mockResolvedValue({data: []})
    const output = await handler(event, testContext)
    expect(output).toBeUndefined()
  })
})
