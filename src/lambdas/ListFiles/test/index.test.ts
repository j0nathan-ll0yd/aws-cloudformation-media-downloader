import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {testContext} from '#util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'

// Set DefaultFile env vars BEFORE importing handler (required by constants.ts at module level)
process.env.DefaultFileSize = '1024'
process.env.DefaultFileName = 'test-default-file.mp4'
process.env.DefaultFileUrl = 'https://example.com/test-default-file.mp4'
process.env.DefaultFileContentType = 'video/mp4'

const fakeUserId = uuidv4()
const {default: queryStubReturnObject} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})

const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
const filesMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))

const {handler} = await import('./../src')

describe('#ListFiles', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    // Default to authenticated user
    event.requestContext.authorizer!.principalId = fakeUserId
  })
  test('(anonymous) should return default file for anonymous users', async () => {
    // Without Authorization header = Anonymous
    delete event.headers.Authorization
    event.requestContext.authorizer!.principalId = 'unknown'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(body.body.keyCount).toEqual(1)
    expect(body.body.contents[0].key).toEqual('test-default-file.mp4')
  })
  test('(unauthenticated) should return 401 for unauthenticated users', async () => {
    // With Authorization header but unknown principalId = Unauthenticated
    event.requestContext.authorizer!.principalId = 'unknown'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
  })
  test('(authenticated) should return empty list when user has no files', async () => {
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(body.body.keyCount).toEqual(0)
  })
  describe('#AWSFailure', () => {
    test('should return 500 error when batch file retrieval fails', async () => {
      const userFileData = queryStubReturnObject.Items || []
      userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: userFileData})
      filesMock.mocks.get.mockResolvedValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(Object.keys(body)).toEqual(expect.arrayContaining(['error', 'requestId']))
    })
  })
})
