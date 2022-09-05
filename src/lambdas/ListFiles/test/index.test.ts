import * as AWS from 'aws-sdk'
import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import {getFixture, testContext} from '../../../util/mocha-setup'
import {handler} from '../src'
import * as chai from 'chai'
import {APIGatewayProxyEvent} from 'aws-lambda'
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client'
import {UnexpectedError} from '../../../util/errors'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)
const docClient = new AWS.DynamoDB.DocumentClient()

describe('#ListFiles', () => {
  const context = testContext
  let event: APIGatewayProxyEvent
  let batchGetStub: sinon.SinonStub
  let queryStub: sinon.SinonStub
  const queryStubReturnObject = localFixture('query-200-OK.json') as DocumentClient.QueryOutput
  if (Array.isArray(queryStubReturnObject.Items)) {
    queryStubReturnObject.Items[0].fileId = docClient.createSet(queryStubReturnObject.Items[0].fileId)
  }
  beforeEach(() => {
    event = localFixture('APIGatewayEvent.json') as APIGatewayProxyEvent
    batchGetStub = sinon.stub(DynamoDB, 'batchGet')
    queryStub = sinon.stub(DynamoDB, 'query')
    process.env.DynamoDBTableFiles = 'Files'
    process.env.DynamoDBTableUserFiles = 'UserFiles'
  })
  afterEach(() => {
    event = localFixture('APIGatewayEvent.json') as APIGatewayProxyEvent
    batchGetStub.restore()
    queryStub.restore()
  })
  it('should list files, if url is present', async () => {
    batchGetStub.returns(localFixture('batchGet-200-OK.json'))
    queryStub.returns(queryStubReturnObject)
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body).to.have.all.keys('keyCount', 'contents')
    expect(body.body.keyCount).to.equal(1)
    expect(body.body.contents[0]).to.have.property('url').that.is.a('string')
  })
  it('should NOT list files, if url is not present (not yet downloaded)', async () => {
    batchGetStub.returns(localFixture('batchGet-200-Filtered.json'))
    queryStub.returns(queryStubReturnObject)
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body).to.have.all.keys('keyCount', 'contents')
    expect(body.body.keyCount).to.equal(0)
  })
  it('should gracefully handle an empty list', async () => {
    batchGetStub.returns(localFixture('batchGet-200-Empty.json'))
    queryStub.returns(localFixture('query-200-Empty.json'))
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body).to.have.all.keys('keyCount', 'contents')
    expect(body.body.keyCount).to.equal(0)
  })
  it('should fail gracefully if query fails', async () => {
    queryStub.rejects('Error')
    expect(handler(event, context)).to.be.rejectedWith(Error)
  })
  it('should return a default file if unauthenticated', async () => {
    delete event.headers['X-User-Id']
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body).to.have.all.keys('keyCount', 'contents')
    expect(body.body.keyCount).to.equal(1)
    expect(body.body.contents[0].fileId).to.equal('default')
  })
  describe('#AWSFailure', () => {
    it('AWS.DynamoDB.DocumentClient.query', async () => {
      queryStub.returns(undefined)
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
    it('AWS.DynamoDB.DocumentClient.batchGet', async () => {
      queryStub.returns(queryStubReturnObject)
      batchGetStub.returns(undefined)
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
  })
})
