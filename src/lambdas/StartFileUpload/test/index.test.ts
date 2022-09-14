import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as YouTube from '../../../lib/vendor/YouTube'
import * as S3 from '../../../lib/vendor/AWS/S3'
import {getFixture, partSize} from '../../../util/mocha-setup'
import * as chai from 'chai'
import {handler} from '../src'
import {videoInfo} from 'ytdl-core'
import {UploadPartEvent} from '../../../types/main'
import {CreateMultipartUploadOutput} from 'aws-sdk/clients/s3'
import {NotFoundError, UnexpectedError} from '../../../util/errors'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#StartFileUpload', () => {
  const event = localFixture('startFileUpload-200-OK.json') as UploadPartEvent
  const mockSuccessHeaders = {
    'accept-ranges': 'bytes',
    'content-length': 82784319,
    'content-type': 'video/mp4'
  }
  const createMultipartUploadResponse = localFixture('createMultipartUpload-200-OK.json') as CreateMultipartUploadOutput
  const fetchVideoInfoResponse = localFixture('fetchVideoInfo-200-OK.json') as Promise<videoInfo>
  let mock: MockAdapter
  let fetchVideoInfoStub: sinon.SinonStub
  let createMultipartUploadStub: sinon.SinonStub
  let updateItemStub: sinon.SinonStub
  beforeEach(() => {
    mock = new MockAdapter(axios)
    createMultipartUploadStub = sinon.stub(S3, 'createMultipartUpload')
    fetchVideoInfoStub = sinon.stub(YouTube, 'fetchVideoInfo').returns(fetchVideoInfoResponse)
    updateItemStub = sinon.stub(DynamoDB, 'updateItem')
  })
  afterEach(() => {
    mock.reset()
    createMultipartUploadStub.restore()
    fetchVideoInfoStub.restore()
    updateItemStub.restore()
  })
  it('should successfully handle a multipart upload', async () => {
    createMultipartUploadStub.returns(createMultipartUploadResponse)
    event.bytesTotal = mockSuccessHeaders['content-length'] = 82784319
    mock.onAny().reply(200, '', mockSuccessHeaders)
    const output = await handler(event)
    expect(output.bytesTotal).to.equal(event.bytesTotal)
    expect(output.partEnd).to.equal(partSize - 1)
    expect(output.uploadId).to.equal(createMultipartUploadResponse.UploadId)
  })
  it('should successfully handle a single part upload', async () => {
    createMultipartUploadStub.returns(createMultipartUploadResponse)
    event.bytesTotal = mockSuccessHeaders['content-length'] = 5242880 - 1000
    mock.onAny().reply(200, '', mockSuccessHeaders)
    const output = await handler(event)
    expect(output.bytesTotal).to.equal(event.bytesTotal)
    expect(output.partEnd).to.equal(event.bytesTotal - 1)
    expect(output.uploadId).to.equal(createMultipartUploadResponse.UploadId)
  })
  it('should gracefully handle if a video cant be found', async () => {
    fetchVideoInfoStub.returns({})
    expect(handler(event)).to.be.rejectedWith(NotFoundError)
  })
  describe('#AWSFailure', () => {
    it('AWS.S3.createMultipartUpload', async () => {
      createMultipartUploadStub.returns(undefined)
      expect(handler(event)).to.be.rejectedWith(UnexpectedError)
    })
  })
})
