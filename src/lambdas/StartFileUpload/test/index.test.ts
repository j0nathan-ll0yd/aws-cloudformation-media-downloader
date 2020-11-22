import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import * as sinon from 'sinon'
import * as YouTube from '../../../lib/vendor/YouTube'
import * as S3 from '../../../lib/vendor/AWS/S3'
import {getFixture, partSize} from '../../../util/mocha-setup'
import chai from 'chai'
import {startFileUpload} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#startFileUpload', () => {
  const event = localFixture('startFileUpload-200-OK.json')
  const mockSuccessHeaders = {
    'accept-ranges': 'bytes',
    'content-length': 82784319,
    'content-type': 'video/mp4'
  }
  const createMultipartUploadResponse = localFixture('createMultipartUpload-200-OK.json')
  let mock
  let fetchVideoInfoStub
  let createMultipartUploadStub
  beforeEach(() => {
    mock = new MockAdapter(axios)
    createMultipartUploadStub = sinon.stub(S3, 'createMultipartUpload')
    fetchVideoInfoStub = sinon.stub(YouTube, 'fetchVideoInfo').returns(localFixture('fetchVideoInfo-200-OK.json'))
  })
  afterEach(() => {
    mock.reset()
    createMultipartUploadStub.restore()
    fetchVideoInfoStub.restore()
  })
  it('should successfully handle a multipart upload', async () => {
    createMultipartUploadStub.returns(createMultipartUploadResponse)
    event.bytesTotal = mockSuccessHeaders['content-length'] = 82784319
    mock.onAny().reply(200, '', mockSuccessHeaders)
    const output = await startFileUpload(event)
    expect(output.bytesTotal).to.equal(event.bytesTotal)
    expect(output.partEnd).to.equal(partSize - 1)
    expect(output.uploadId).to.equal(createMultipartUploadResponse.UploadId)
  })
  it('should successfully handle a single part upload', async () => {
    createMultipartUploadStub.returns(createMultipartUploadResponse)
    event.bytesTotal = mockSuccessHeaders['content-length'] = 5242880 - 1000
    mock.onAny().reply(200, '', mockSuccessHeaders)
    const output = await startFileUpload(event)
    expect(output.bytesTotal).to.equal(event.bytesTotal)
    expect(output.partEnd).to.equal(event.bytesTotal - 1)
    expect(output.uploadId).to.equal(createMultipartUploadResponse.UploadId)
  })
  it('should gracefully handle a failure', async () => {
    createMultipartUploadStub.rejects('Error')
    expect(startFileUpload(event)).to.be.rejectedWith(Error)
  })
})
