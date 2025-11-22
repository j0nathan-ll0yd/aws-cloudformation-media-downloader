import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {testContext} from '../../../util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../types/main'
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'

const fakeUserId = uuidv4()
const {default: queryStubReturnObject} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
if (Array.isArray(queryStubReturnObject.Items)) {
  queryStubReturnObject.Items[0].fileId = Array.from(new Set(queryStubReturnObject.Items[0].fileId))
}

const userFilesMock = createElectroDBEntityMock()
const filesMock = createElectroDBEntityMock()
jest.unstable_mockModule('../../../lib/vendor/ElectroDB/entities/UserFiles', () => ({
  UserFiles: userFilesMock.entity
}))
jest.unstable_mockModule('../../../lib/vendor/ElectroDB/entities/Files', () => ({
  Files: filesMock.entity
}))

const {handler} = await import('./../src')

describe('#ListFiles', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
  })
  describe('#AWSFailure', () => {
    test('ElectroDB UserFiles.get', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      userFilesMock.mocks.get.mockResolvedValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(200)
      const body = JSON.parse(output.body)
      expect(body.body.keyCount).toEqual(0)
    })
    test('ElectroDB Files.get', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      const userFileData = queryStubReturnObject.Items?.[0]
      userFilesMock.mocks.get.mockResolvedValue({data: userFileData})
      filesMock.mocks.get.mockResolvedValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(Object.keys(body)).toEqual(expect.arrayContaining(['error', 'requestId']))
    })
  })
})
