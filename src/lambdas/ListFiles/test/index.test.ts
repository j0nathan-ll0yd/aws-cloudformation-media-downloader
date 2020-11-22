import * as sinon from 'sinon'
import * as S3 from '../../../lib/vendor/AWS/S3'
import {getFixture} from '../../../util/mocha-setup'
import {listFiles} from '../src'
import chai from 'chai'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#listFiles', () => {
  const context = localFixture('Context.json')
  let event
  let listObjectsStub
  beforeEach(() => {
    event = localFixture('APIGatewayEvent.json')
    listObjectsStub = sinon.stub(S3, 'listObjects')
  })
  afterEach(() => {
    event = localFixture('APIGatewayEvent.json')
    listObjectsStub.restore()
  })
  it('should list files, if present', async () => {
    listObjectsStub.returns(localFixture('listObjects-200-OK.json'))
    const output = await listFiles(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body).to.have.all.keys('isTruncated', 'contents', 'name', 'prefix', 'maxKeys', 'keyCount', 'commonPrefixes')
    expect(body.body.keyCount).to.equal(1)
    expect(body.body.contents[0]).to.have.property('fileUrl').that.is.a('string')
  })
  it('should gracefully handle an empty list', async () => {
    listObjectsStub.returns(localFixture('listObjects-200-Empty.json'))
    const output = await listFiles(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body).to.have.all.keys('isTruncated', 'contents', 'name', 'prefix', 'maxKeys', 'keyCount', 'commonPrefixes')
    expect(body.body.keyCount).to.equal(0)
  })
  it('should fail gracefully if listObjects fails', async () => {
    listObjectsStub.rejects('Error')
    expect(listFiles(event, context)).to.be.rejectedWith(Error)
  })
})
