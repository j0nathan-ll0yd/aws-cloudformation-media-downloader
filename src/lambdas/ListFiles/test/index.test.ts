import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {testContext} from '#util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import {CustomAPIGatewayRequestAuthorizerEvent} from '#types/main'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'

const fakeUserId = uuidv4()
const {default: queryStubReturnObject} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})

const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
const filesMock = createElectroDBEntityMock()
jest.unstable_mockModule('../../../entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))
jest.unstable_mockModule('../../../entities/Files', () => ({Files: filesMock.entity}))

const {handler} = await import('./../src')

describe('#ListFiles', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
  })
  describe('#AWSFailure', () => {
    test('should return empty list when user has no files', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(200)
      const body = JSON.parse(output.body)
      expect(body.body.keyCount).toEqual(0)
    })
    test('should return 500 error when batch file retrieval fails', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
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
