import axios, {AxiosRequestConfig, AxiosResponseHeaders} from 'axios'
import MockAdapter from 'axios-mock-adapter'
import * as crypto from 'crypto'
import * as chai from 'chai'
import * as sinon from 'sinon'
import * as S3 from '../../../lib/vendor/AWS/S3'
import {CompleteFileUploadEvent, UploadPartEvent} from '../../../types/main'
import {partSize} from '../../../util/mocha-setup'
import {handler} from '../src'
import {Part} from 'aws-sdk/clients/s3'
const expect = chai.expect

describe('#UploadPart', () => {
  let mock: MockAdapter
  let uploadPartStub: sinon.SinonStub
  beforeEach(() => {
    mock = new MockAdapter(axios)
    uploadPartStub = sinon.stub(S3, 'uploadPart').resolves({
      ETag: crypto.createHash('md5').update('some_string').digest('hex')
    })
  })
  afterEach(() => {
    mock.reset()
    uploadPartStub.restore()
  })
  it('should handle a multipart file', async () => {
    const bytesTotal = 82784319
    mock.onAny().reply((config) => {
      return mockResponseUploadPart(config, bytesTotal, partSize)
    })
    const totalParts = Math.round(bytesTotal / partSize)
    const responses = await mockIterationsOfUploadPart(bytesTotal, partSize)
    const finalPart = responses.pop() as CompleteFileUploadEvent
    const uploadPart = responses.pop() as UploadPartEvent
    if ('partNumber' in uploadPart) {
      expect(uploadPart.partNumber).to.equal(totalParts)
    }
    expect(finalPart.partTags.length).to.equal(totalParts)
    expect(finalPart.bytesRemaining).to.equal(0)
  })
  it('should handle a single part file', async () => {
    const bytesTotal = 5242880 - 1000
    mock.onAny().reply((config) => {
      return mockResponseUploadPart(config, bytesTotal, partSize)
    })
    const totalParts = Math.round(bytesTotal / partSize)
    const responses = await mockIterationsOfUploadPart(bytesTotal, partSize)
    expect(responses.length).to.equal(totalParts)
    const finalPart = responses.pop() as CompleteFileUploadEvent
    expect(finalPart.partTags.length).to.equal(totalParts)
    expect(finalPart.bytesRemaining).to.equal(0)
  })
  describe('#NetworkFailure', () => {
    it('should gracefully handle a failure', async () => {
      const bytesTotal = 5242880 - 1000
      mock.onAny().networkError()
      expect(mockIterationsOfUploadPart(bytesTotal, partSize)).to.be.rejectedWith('Network Error')
    })
  })
})

function mockResponseUploadPart(config: AxiosRequestConfig, bytesTotal: number, partSize: number) {
  const headers = config.headers as AxiosResponseHeaders
  const [, beg, end] = /bytes=(\d+)-(\d+)/.exec(headers.Range.toString()) || ['', '', '']
  return [
    206,
    'hello',
    {
      'accept-ranges': 'bytes',
      'content-length': partSize,
      'content-range': `bytes ${beg}-${end}/${bytesTotal}`,
      'content-type': 'video/mp4'
    }
  ]
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
