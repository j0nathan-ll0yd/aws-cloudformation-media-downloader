import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as SQS from '../../../lib/vendor/AWS/SQS'
import {getFixture} from '../../../util/mocha-setup'
import chai from 'chai'
import {handleFeedlyEvent} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#handleFeedlyEvent', () => {
  const context = localFixture('Context.json')
  let event
  let queryStub
  let sendMessageStub
  let updateItemStub
  beforeEach(() => {
    event = localFixture('APIGatewayEvent.json')
    queryStub = sinon.stub(DynamoDB, 'query').returns(localFixture('query-204-NoContent.json'))
    sendMessageStub = sinon.stub(SQS, 'sendMessage')
    updateItemStub = sinon.stub(DynamoDB, 'updateItem')
  })
  afterEach(() => {
    event = localFixture('APIGatewayEvent.json')
    queryStub.restore()
    sendMessageStub.restore()
    updateItemStub.restore()
  })
  it('should trigger the download of a new file (if not present)', async () => {
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-200-OK.json'))
    updateItemStub.returns(localFixture('updateItem-202-Accepted.json'))
    const output = await handleFeedlyEvent(event, context)
    expect(output.statusCode).to.equal(202)
    const body = JSON.parse(output.body)
    expect(body.body.status).to.equal('Accepted')
  })
  it('should dispatch a message to clients (if the file already exists)', async () => {
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-200-OK.json'))
    queryStub.returns(localFixture('query-200-OK.json'))
    const output = await handleFeedlyEvent(event, context)
    expect(output.statusCode).to.equal(204)
  })
  it('should fail gracefully if the startExecution fails', async () => {
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-200-OK.json'))
    updateItemStub.rejects('Error')
    const output = await handleFeedlyEvent(event, context)
    expect(output.statusCode).to.equal(500)
  })
  it('should handle an invalid request body', async () => {
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-400-MissingRequired.json'))
    const output = await handleFeedlyEvent(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).to.have.property('articleURL')
    expect(body.error.message.articleURL[0]).to.have.string('is required')
  })
  it('should handle a missing user ID', async () => {
    delete event.headers['X-User-Id']
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-200-OK.json'))
    const output = await handleFeedlyEvent(event, context)
    expect(output.statusCode).to.equal(500)
  })
  it('should handle an invalid event body', async () => {
    event.body = 'hello'
    const output = await handleFeedlyEvent(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.code).to.equal('custom-4XX-generic')
    expect(body.error.message).to.equal('Request body must be valid JSON')
  })
  it('should handle an invalid (non-YouTube) URL', async () => {
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-400-InvalidURL.json'))
    const output = await handleFeedlyEvent(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).to.have.property('articleURL')
    expect(body.error.message.articleURL[0]).to.have.string('not a valid YouTube URL')
  })
})
