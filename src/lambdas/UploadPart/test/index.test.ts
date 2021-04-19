import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import crypto from 'crypto'
import chai from 'chai'
import * as sinon from 'sinon'
import * as S3 from '../../../lib/vendor/AWS/S3'
import {UploadPartEvent} from '../../../types/main'
import {partSize} from '../../../util/mocha-setup'
import {uploadFilePart} from '../src'
const expect = chai.expect

describe('#uploadPart', () => {
  let mock
  let uploadPartStub
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
    mock.onAny().reply((config) => mockResponseUploadPart(config, bytesTotal, partSize))
    const totalParts = Math.round(bytesTotal / partSize)
    const responses = await mockIterationsOfUploadPart(bytesTotal, partSize)
    const finalPart = responses.pop()
    const uploadPart = responses.pop()
    expect(uploadPart.partNumber).to.equal(totalParts)
    expect(finalPart.partTags.length).to.equal(totalParts)
    expect(finalPart.bytesRemaining).to.equal(0)
  })
  it('should handle a single part file', async () => {
    const bytesTotal = 5242880 - 1000
    mock.onAny().reply((config) => mockResponseUploadPart(config, bytesTotal, partSize))
    const totalParts = Math.round(bytesTotal / partSize)
    const responses = await mockIterationsOfUploadPart(bytesTotal, partSize)
    expect(responses.length).to.equal(totalParts)
    const finalPart = responses.pop()
    expect(finalPart.partTags.length).to.equal(totalParts)
    expect(finalPart.bytesRemaining).to.equal(0)
  })
  it('should gracefully handle a failure', async () => {
    const bytesTotal = 5242880 - 1000
    mock.onAny().networkError()
    expect(mockIterationsOfUploadPart(bytesTotal, partSize)).to.be.rejectedWith('Network Error')
  })
})

function mockResponseUploadPart(config, bytesTotal, partSize) {
  return new Promise((resolve) => {
    const [, beg, end] = /bytes=(\d+)-(\d+)/.exec(config.headers.Range)
    return resolve([206, 'hello', {
      'accept-ranges': 'bytes',
      'content-length': partSize,
      'content-range': `bytes ${beg}-${end}/${bytesTotal}`,
      'content-type': 'video/mp4'
    }])
  })
}

async function mockIterationsOfUploadPart(bytesTotal, partSize) {
  const bucket = 'lifegames-fileviewer-s3bucket-yqm2cswg5ozl'
  const key = '20191107-[sxephil]-Title'
  const uploadId = 'some-id1'
  const url = 'https://example.com/some-video.mp4'
  const responses = []
  const partTags = []
  let partNumber = 1
  let bytesRemaining = bytesTotal
  let partEnd = Math.min(partSize, bytesTotal) - 1
  let partBeg = 0
  const fileId = 'yqm2cswg5ozl'
  while (bytesRemaining > 0) {
    const event = {bucket, bytesRemaining, bytesTotal, fileId, key, partBeg, partEnd, partNumber, partSize, partTags, uploadId, url}
    const output = await uploadFilePart(event)
    responses.push(output)
    if (output.bytesRemaining > 0) {
      ({partBeg, partEnd, partNumber} = output as UploadPartEvent)
    }
    bytesRemaining = bytesRemaining - partSize
  }
  return responses
}
