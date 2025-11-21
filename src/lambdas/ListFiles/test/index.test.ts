import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {testContext} from '../../../util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../types/main'

const fakeUserId = uuidv4()
const {default: queryStubReturnObject} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
if (Array.isArray(queryStubReturnObject.Items)) {
  queryStubReturnObject.Items[0].fileId = Array.from(new Set(queryStubReturnObject.Items[0].fileId))
}

const userFilesGetMock = jest.fn()
const filesGetMock = jest.fn()
jest.unstable_mockModule('../../../lib/vendor/ElectroDB/entities/UserFiles', () => ({
  UserFiles: {
    get: jest.fn(() => ({
      go: userFilesGetMock
    }))
  }
}))
jest.unstable_mockModule('../../../lib/vendor/ElectroDB/entities/Files', () => ({
  Files: {
    get: jest.fn(() => ({
      go: filesGetMock
    }))
  }
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
      userFilesGetMock.mockResolvedValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(200)
      const body = JSON.parse(output.body)
      expect(body.keyCount).toEqual(0)
    })
    test('ElectroDB Files.get', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      const userFileData = queryStubReturnObject.Items?.[0]
      userFilesGetMock.mockResolvedValue({data: userFileData})
      filesGetMock.mockResolvedValue(undefined)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(Object.keys(body)).toEqual(expect.arrayContaining(['error', 'requestId']))
    })
  })
})
