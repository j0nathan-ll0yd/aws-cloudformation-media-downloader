import {describe, expect, jest, test} from '@jest/globals'
import {S3Event} from 'aws-lambda'
import {testContext} from '#util/jest-setup'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'

const filesMock = createElectroDBEntityMock({queryIndexes: ['byKey']})
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))

const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byFile']})
jest.unstable_mockModule('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))

jest.unstable_mockModule(
  '../../../lib/vendor/AWS/SQS',
  () => ({
    sendMessage: jest.fn(),
    stringAttribute: jest.fn((value: string) => ({DataType: 'String', StringValue: value})),
    numberAttribute: jest.fn((value: number) => ({DataType: 'Number', StringValue: value.toString()}))
  })
)

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
  test('should throw an error if the file does not exist', async () => {
    filesMock.mocks.query.byKey!.go.mockResolvedValue({data: []})
    await expect(handler(event, testContext)).rejects.toThrow(Error)
  })
})
