import {describe, expect, test, jest} from '@jest/globals'
import {partSize} from '../../../util/jest-setup'
import {UnexpectedError} from '../../../util/errors'
import {StartFileUploadParams} from '../../../types/main'
import {AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig} from 'axios'

const axiosGetMock = jest.fn()
jest.unstable_mockModule('axios', () => ({
  default: axiosGetMock
}))

const createMultipartUploadMock = jest.fn()
const {default: createMultipartUploadResponse} = await import('./fixtures/createMultipartUpload-200-OK.json', {assert: {type: 'json'}})
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  createMultipartUpload: createMultipartUploadMock
}))

const fetchVideoInfoMock = jest.fn()
const {default: fetchVideoInfoResponse} = await import('./fixtures/fetchVideoInfo-200-OK.json', {assert: {type: 'json'}})
jest.unstable_mockModule('../../../lib/vendor/YouTube', () => ({
  fetchVideoInfo: fetchVideoInfoMock,
  chooseVideoFormat: jest.fn().mockReturnValue(fetchVideoInfoResponse.formats[0])
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  updateItem: jest.fn().mockReturnValue({}),
  deleteItem: jest.fn(),
  query: jest.fn(),
  scan: jest.fn()
}))

const {default: eventMock} = await import('./fixtures/startFileUpload-200-OK.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

function mockResponseUploadPart(config: AxiosRequestConfig, bytesTotal: number): AxiosResponse {
  return {
    config: config as InternalAxiosRequestConfig,
    data: 'test',
    status: 200,
    statusText: 'hello',
    headers: {
      'accept-ranges': 'bytes',
      'content-length': bytesTotal,
      'content-type': 'video/mp4'
    }
  }
}

describe('#StartFileUpload', () => {
  const event = eventMock as StartFileUploadParams
  test('should successfully handle a multipart upload', async () => {
    createMultipartUploadMock.mockReturnValue(createMultipartUploadResponse)
    fetchVideoInfoMock.mockReturnValue(fetchVideoInfoResponse)
    const bytesTotal = 82784319
    axiosGetMock.mockImplementation(() => {
      const config = axiosGetMock.mock.calls[0][0] as AxiosRequestConfig
      return mockResponseUploadPart(config, bytesTotal)
    })
    const output = await handler(event)
    expect(output.bytesTotal).toEqual(bytesTotal)
    expect(output.partEnd).toEqual(partSize - 1)
    expect(output.uploadId).toEqual(createMultipartUploadResponse.UploadId)
  })
  test('should successfully handle a single part upload', async () => {
    createMultipartUploadMock.mockReturnValue(createMultipartUploadResponse)
    fetchVideoInfoMock.mockReturnValue(fetchVideoInfoResponse)
    axiosGetMock.mockImplementation(() => {
      const config = axiosGetMock.mock.calls[0][0] as AxiosRequestConfig
      return mockResponseUploadPart(config, bytesTotal)
    })
    const bytesTotal = 5242880 - 1000
    const output = await handler(event)
    expect(output.bytesTotal).toEqual(bytesTotal)
    expect(output.partEnd).toEqual(bytesTotal - 1)
    expect(output.uploadId).toEqual(createMultipartUploadResponse.UploadId)
  })
  test('should gracefully handle if a video cant be found', async () => {
    fetchVideoInfoMock.mockImplementation(() => {
      throw new UnexpectedError('Video not found')
    })
    await expect(handler(event)).rejects.toThrow(UnexpectedError)
  })
  describe('#AWSFailure', () => {
    test('AWS.S3.createMultipartUpload', async () => {
      createMultipartUploadMock.mockReturnValue(undefined)
      await expect(handler(event)).rejects.toThrow(UnexpectedError)
    })
  })
})
