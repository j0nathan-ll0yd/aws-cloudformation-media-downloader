import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import {getFixture} from '../../../util/mocha-setup'
import chai from 'chai'
import {handleFeedlyEvent} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#handleFeedlyEvent', () => {
  const context = localFixture('Context.json')
  let event
  let updateItemStub
  beforeEach(() => {
    event = localFixture('APIGatewayEvent.json')
    updateItemStub = sinon.stub(DynamoDB, 'updateItem')
  })
  afterEach(() => {
    event = localFixture('APIGatewayEvent.json')
    updateItemStub.restore()
  })
  it('should handle a feedly event', async () => {
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-200-OK.json'))
    updateItemStub.returns(localFixture('updateItem-202-Accepted.json'))
    const output = await handleFeedlyEvent(event, context)
    expect(output.statusCode).to.equal(202)
    const body = JSON.parse(output.body)
    expect(body.body.status).to.equal('Accepted')
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
