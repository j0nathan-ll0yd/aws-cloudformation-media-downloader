import {describe, expect, test, jest} from '@jest/globals'
import {UnexpectedError} from '../../../util/errors'
const {default: completeMultipartUploadResponse} = await import('./fixtures/completeMultipartUpload-200-OK.json', {assert: {type: 'json'}})
const {default: event} = await import('./fixtures/completeFileUpload-200-OK.json', {assert: {type: 'json'}})
const {default: updateItemResponse} = await import('./fixtures/completeFileUpload-200-OK.json', {assert: {type: 'json'}})

const completeMultipartUploadMock = jest.fn()
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  completeMultipartUpload: completeMultipartUploadMock
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  updateItem: jest.fn().mockReturnValue(updateItemResponse)
}))

const {handler} = await import('./../src')

describe('#CompleteFileUpload', () => {
  test('should successfully handle a multipart upload', async () => {
    completeMultipartUploadMock.mockReturnValue(completeMultipartUploadResponse)
    const output = await handler(event)
    expect(Object.keys(output)).toEqual(expect.arrayContaining(['Location', 'Bucket', 'Key', 'ETag']))
  })
  describe('#AWSFailure', () => {
    test('AWS.S3.completeMultipartUpload', async () => {
      const message = 'An unexpected error occured.'
      completeMultipartUploadMock.mockImplementation(() => {
        throw new UnexpectedError(message)
      })
      await expect(handler(event)).rejects.toThrowError(message)
    })
  })
})
