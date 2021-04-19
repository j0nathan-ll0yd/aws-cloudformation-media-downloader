import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as S3 from '../../../lib/vendor/AWS/S3'
import { getFixture } from '../../../util/mocha-setup'
import { completeFileUpload } from '../src'
import chai from 'chai'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#completeFileUpload', () => {
  const event = localFixture('completeFileUpload-200-OK.json')
  const completeMultipartUploadResponse = localFixture('completeMultipartUpload-200-OK.json')
  const updateItemResponse = localFixture('updateItem-200-OK.json')
  let completeMultipartUploadStub
  let updateItemStub
  beforeEach(() => {
    completeMultipartUploadStub = sinon.stub(S3, 'completeMultipartUpload')
    updateItemStub = sinon.stub(DynamoDB, 'updateItem')
  })
  afterEach(() => {
    completeMultipartUploadStub.restore()
    updateItemStub.restore()
  })
  it('should successfully handle a multipart upload', async () => {
    updateItemStub.returns(updateItemResponse)
    completeMultipartUploadStub.returns(completeMultipartUploadResponse)
    const output = await completeFileUpload(event)
    expect(output).to.have.all.keys('Location', 'Bucket', 'Key', 'ETag')
  })
  it('should gracefully handle a failure', async () => {
    const error = new Error()
    error.name = 'EntityTooSmall'
    error.message = 'Your proposed upload is smaller than the minimum allowed size'
    completeMultipartUploadStub.rejects(error)
    expect(completeFileUpload(event)).to.be.rejectedWith(`${error.name}: ${error.message}`)
  })
})
