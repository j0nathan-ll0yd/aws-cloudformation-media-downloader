import {describe, expect, test, jest} from '@jest/globals'
import {AxiosError, AxiosRequestConfig, AxiosResponse, AxiosResponseHeaders, InternalAxiosRequestConfig} from 'axios'
import * as crypto from 'crypto'
import {CompleteFileUploadEvent, UploadPartEvent} from '../../../types/main'
import {partSize} from '../../../util/mocha-setup'
import {Part} from 'aws-sdk/clients/s3'

const axiosGetMock = jest.fn()
jest.unstable_mockModule('axios', () => ({
  default: axiosGetMock
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  uploadPart: jest.fn().mockReturnValue({
    ETag: crypto.createHash('md5').update('some_string').digest('hex')
  })
}))

const {handler} = await import('./../src')

describe('#UploadPart', () => {
  test('should handle a multipart file', async () => {
    const bytesTotal = 82784319
    axiosGetMock.mockImplementation(() => {
      const config = axiosGetMock.mock.calls[0][0] as AxiosRequestConfig
      return mockResponseUploadPart(config, bytesTotal, partSize)
    })
    const totalParts = Math.round(bytesTotal / partSize)
    const responses = await mockIterationsOfUploadPart(bytesTotal, partSize)
    const finalPart = responses.pop() as CompleteFileUploadEvent
    const uploadPart = responses.pop() as UploadPartEvent
    if ('partNumber' in uploadPart) {
      expect(uploadPart.partNumber).toEqual(totalParts)
    }
    expect(finalPart.partTags.length).toEqual(totalParts)
    expect(finalPart.bytesRemaining).toEqual(0)
  })
  test('should handle a single part file', async () => {
    const bytesTotal = 5242880 - 1000
    axiosGetMock.mockImplementation(() => {
      const config = axiosGetMock.mock.calls[0][0] as AxiosRequestConfig
      return mockResponseUploadPart(config, bytesTotal, partSize)
    })
    const totalParts = Math.round(bytesTotal / partSize)
    const responses = await mockIterationsOfUploadPart(bytesTotal, partSize)
    expect(responses.length).toEqual(totalParts)
    const finalPart = responses.pop() as CompleteFileUploadEvent
    expect(finalPart.partTags.length).toEqual(totalParts)
    expect(finalPart.bytesRemaining).toEqual(0)
  })
  describe('#NetworkFailure', () => {
    test('should gracefully handle a failure', async () => {
      const bytesTotal = 5242880 - 1000
      axiosGetMock.mockImplementation(() => {
        throw new AxiosError('Network Error')
      })
      await expect(mockIterationsOfUploadPart(bytesTotal, partSize)).rejects.toThrowError('Network Error')
    })
  })
})

function mockResponseUploadPart(config: AxiosRequestConfig, bytesTotal: number, partSize: number): AxiosResponse {
  const headers = config.headers as AxiosResponseHeaders
  const [, beg, end] = /bytes=(\d+)-(\d+)/.exec(headers.Range.toString()) || ['', '', '']
  return {
    config: config as InternalAxiosRequestConfig,
    data: 'test',
    status: 206,
    statusText: 'hello',
    headers: {
      'accept-ranges': 'bytes',
      'content-length': partSize,
      'content-range': `bytes ${beg}-${end}/${bytesTotal}`,
      'content-type': 'video/mp4'
    }
  }
}

async function mockIterationsOfUploadPart(bytesTotal: number, partSize: number) {
  const bucket = 'lifegames-fileviewer-s3bucket-yqm2cswg5ozl'
  const key = '20191107-[sxephil]-Title'
  const uploadId = 'some-id1'
  const url = 'https://example.com/some-video.mp4'
  const responses = []
  const partTags: Part[] = []
  let partNumber = 1
  let bytesRemaining = bytesTotal
  let partEnd = Math.min(partSize, bytesTotal) - 1
  let partBeg = 0
  const fileId = 'yqm2cswg5ozl'
  while (bytesRemaining > 0) {
    const event = {
      bucket,
      bytesRemaining,
      bytesTotal,
      fileId,
      key,
      partBeg,
      partEnd,
      partNumber,
      partSize,
      partTags,
      uploadId,
      url
    }
    const output = await handler(event)
    responses.push(output)
    if (output.bytesRemaining > 0) {
      ;({partBeg, partEnd, partNumber} = output as UploadPartEvent)
    }
    bytesRemaining = bytesRemaining - partSize
  }
  return responses
}
