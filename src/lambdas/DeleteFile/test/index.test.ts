import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {testContext} from '#util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'

const fakeUserId = uuidv4()
const fakeFileId = 'test-file-id'
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})

// Mock S3 vendor wrapper
const deleteObjectMock = jest.fn<(bucket: string, key: string) => Promise<unknown>>()
jest.unstable_mockModule('#lib/vendor/AWS/S3', () => ({
  deleteObject: deleteObjectMock
}))

// Mock ElectroDB entities
const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byFile']})
const filesMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))

const {handler} = await import('./../src')

describe('#DeleteFile', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent

  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    event.pathParameters = {fileId: fakeFileId}
    jest.clearAllMocks()
    process.env.S3BucketName = 'test-bucket'

    // Set default mock return values
    userFilesMock.mocks.get.mockResolvedValue({data: {userId: fakeUserId, fileId: fakeFileId}, unprocessed: []})
    userFilesMock.mocks.delete.mockResolvedValue({unprocessed: []})
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: []})
    filesMock.mocks.get.mockResolvedValue({data: null, unprocessed: []})
    filesMock.mocks.delete.mockResolvedValue({unprocessed: []})
    deleteObjectMock.mockResolvedValue({})
  })

  describe('#Authorization', () => {
    test('should return 401 when user is unauthenticated', async () => {
      event.requestContext.authorizer!.principalId = 'unknown'
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(401)
    })

    test('should return 401 when user is anonymous', async () => {
      event.requestContext.authorizer!.principalId = 'anonymous'
      delete event.headers.Authorization
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(401)
    })
  })

  describe('#Validation', () => {
    test('should return 400 when fileId is missing', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.pathParameters = null
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(400)
      const body = JSON.parse(output.body)
      expect(body.error.message).toEqual('fileId is required')
    })

    test('should return 404 when UserFiles association does not exist', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      userFilesMock.mocks.get.mockResolvedValue({data: null, unprocessed: []})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(404)
      const body = JSON.parse(output.body)
      expect(body.error.message).toEqual('File not found for this user')
    })
  })

  describe('#DeleteWithOtherUsers', () => {
    test('should delete only UserFiles record when other users reference the file', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId

      // Mock UserFiles.get to return the association
      userFilesMock.mocks.get.mockResolvedValue({
        data: {userId: fakeUserId, fileId: fakeFileId},
        unprocessed: []
      })

      // Mock UserFiles.delete to succeed
      userFilesMock.mocks.delete.mockResolvedValue({unprocessed: []})

      // Mock UserFiles.query.byFile to return other users
      userFilesMock.mocks.query.byFile!.go.mockResolvedValue({
        data: [{userId: 'other-user-id', fileId: fakeFileId}]
      })

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(204)
      expect(userFilesMock.mocks.delete).toHaveBeenCalled()
      expect(deleteObjectMock).not.toHaveBeenCalled()
      expect(filesMock.mocks.delete).not.toHaveBeenCalled()
    })
  })

  describe('#DeleteWithNoOtherUsers', () => {
    test('should delete UserFiles, Files, and S3 object when no other users reference the file', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId

      // Mock UserFiles.get to return the association
      userFilesMock.mocks.get.mockResolvedValue({
        data: {userId: fakeUserId, fileId: fakeFileId},
        unprocessed: []
      })

      // Mock UserFiles.delete to succeed
      userFilesMock.mocks.delete.mockResolvedValue({unprocessed: []})

      // Mock UserFiles.query.byFile to return no other users
      userFilesMock.mocks.query.byFile!.go.mockResolvedValue({
        data: []
      })

      // Mock Files.get to return the file
      filesMock.mocks.get.mockResolvedValue({
        data: {
          fileId: fakeFileId,
          key: 'path/to/file.mp4',
          title: 'Test File',
          size: 1024,
          status: 'Downloaded'
        },
        unprocessed: []
      })

      // Mock Files.delete to succeed
      filesMock.mocks.delete.mockResolvedValue({unprocessed: []})

      // Mock S3 deleteObject to succeed
      deleteObjectMock.mockResolvedValue({})

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(204)
      expect(userFilesMock.mocks.delete).toHaveBeenCalled()
      expect(deleteObjectMock).toHaveBeenCalledWith('test-bucket', 'path/to/file.mp4')
      expect(filesMock.mocks.delete).toHaveBeenCalled()
    })

    test('should continue with DynamoDB deletion even if S3 deletion fails', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId

      // Mock UserFiles.get to return the association
      userFilesMock.mocks.get.mockResolvedValue({
        data: {userId: fakeUserId, fileId: fakeFileId},
        unprocessed: []
      })

      // Mock UserFiles.delete to succeed
      userFilesMock.mocks.delete.mockResolvedValue({unprocessed: []})

      // Mock UserFiles.query.byFile to return no other users
      userFilesMock.mocks.query.byFile!.go.mockResolvedValue({
        data: []
      })

      // Mock Files.get to return the file
      filesMock.mocks.get.mockResolvedValue({
        data: {
          fileId: fakeFileId,
          key: 'path/to/file.mp4',
          title: 'Test File',
          size: 1024,
          status: 'Downloaded'
        },
        unprocessed: []
      })

      // Mock Files.delete to succeed
      filesMock.mocks.delete.mockResolvedValue({unprocessed: []})

      // Mock S3 deleteObject to fail
      deleteObjectMock.mockRejectedValue(new Error('S3 deletion failed'))

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(204)
      expect(filesMock.mocks.delete).toHaveBeenCalled()
    })
  })
})
