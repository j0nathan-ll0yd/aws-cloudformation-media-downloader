import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as S3 from '../../../lib/vendor/AWS/S3'
import {getFixture} from '../../../util/mocha-setup'
import {handler} from '../src/index'
import * as chai from 'chai'
import {UnexpectedError} from '../../../util/errors'
import {CompleteFileUploadEvent} from '../../../types/main'
const expect = chai.expect
import path from 'path'
import {fileURLToPath} from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const localFixture = getFixture.bind(null, __dirname)

describe('#CompleteFileUpload', () => {
  const event = localFixture('completeFileUpload-200-OK.json') as CompleteFileUploadEvent
  const completeMultipartUploadResponse = localFixture('completeMultipartUpload-200-OK.json')
  const updateItemResponse = localFixture('updateItem-200-OK.json')
  let completeMultipartUploadStub: sinon.SinonStub
  let updateItemStub: sinon.SinonStub
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
    const output = await handler(event)
    expect(output).to.have.all.keys('Location', 'Bucket', 'Key', 'ETag')
  })
  describe('#AWSFailure', () => {
    it('AWS.S3.completeMultipartUpload', async () => {
      const message = 'An unexpected error occured.'
      const error = new UnexpectedError(message)
      completeMultipartUploadStub.rejects(error)
      expect(handler(event)).to.be.rejectedWith(`${error.name}: ${message}`)
    })
  })
})
