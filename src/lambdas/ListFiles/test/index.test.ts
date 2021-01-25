import * as AWS from 'aws-sdk'
import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import {getFixture} from '../../../util/mocha-setup'
import {listFiles} from '../src'
import chai from 'chai'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)
const docClient = new AWS.DynamoDB.DocumentClient()

describe('#listFiles', () => {
  const context = localFixture('Context.json')
  let event
  let batchGetStub
  let queryStub
  const queryStubReturnObject = localFixture('query-200-OK.json')
  queryStubReturnObject.Items[0].fileId = docClient.createSet(queryStubReturnObject.Items[0].fileId)
  beforeEach(() => {
    event = localFixture('APIGatewayEvent.json')
    batchGetStub = sinon.stub(DynamoDB, 'batchGet')
    queryStub = sinon.stub(DynamoDB, 'query')
    process.env.DynamoTableFiles = 'Files'
    process.env.DynamoTableUserFiles = 'UserFiles'
  })
  afterEach(() => {
    event = localFixture('APIGatewayEvent.json')
    batchGetStub.restore()
    queryStub.restore()
    delete process.env.DynamoTableFiles
    delete process.env.DynamoTableUserFiles
  })
  it('should list files, if url is present', async () => {
    batchGetStub.returns(localFixture('batchGet-200-OK.json'))
    queryStub.returns(queryStubReturnObject)
    const output = await listFiles(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body).to.have.all.keys('keyCount', 'contents')
    expect(body.body.keyCount).to.equal(1)
    expect(body.body.contents[0]).to.have.property('url').that.is.a('string')
  })
  it('should NOT list files, if url is not present (not yet downloaded)', async () => {
    batchGetStub.returns(localFixture('batchGet-200-Filtered.json'))
    queryStub.returns(queryStubReturnObject)
    const output = await listFiles(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body).to.have.all.keys('keyCount', 'contents')
    expect(body.body.keyCount).to.equal(0)
  })
  it('should gracefully handle an empty list', async () => {
    batchGetStub.returns(localFixture('batchGet-200-Empty.json'))
    queryStub.returns(localFixture('query-200-Empty.json'))
    const output = await listFiles(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body).to.have.all.keys('keyCount', 'contents')
    expect(body.body.keyCount).to.equal(0)
  })
  it('should fail gracefully if query fails', async () => {
    queryStub.rejects('Error')
    expect(listFiles(event, context)).to.be.rejectedWith(Error)
  })
})
