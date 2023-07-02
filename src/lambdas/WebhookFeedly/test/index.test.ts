import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as StepFunctions from '../../../lib/vendor/AWS/StepFunctions'
import * as SQS from '../../../lib/vendor/AWS/SQS'
import {getFixture, testContext} from '../../../util/mocha-setup'
import * as chai from 'chai'
import {handler} from '../src'
import {APIGatewayEvent} from 'aws-lambda'
import {v4 as uuidv4} from 'uuid'
import {UnexpectedError} from '../../../util/errors'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)
const fakeUserId = uuidv4()

/* eslint-disable  @typescript-eslint/no-non-null-assertion */
describe('#WebhookFeedly', () => {
  const context = testContext
  let event: APIGatewayEvent
  beforeEach(() => {
    event = localFixture('APIGatewayEvent.json') as APIGatewayEvent
  })
  afterEach(() => {
    sinon.restore()
  })
  it('should trigger the download of a new file immediately (if not present)', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-200-OK.json'))
    sinon.stub(DynamoDB, 'updateItem').resolves({})
    sinon.stub(DynamoDB, 'query').resolves(localFixture('query-204-NoContent.json'))
    sinon.stub(StepFunctions, 'startExecution').resolves({
      executionArn: 'arn:aws:states:us-west-2:203465012143:execution:MultipartUpload:1666060419059',
      startDate: new Date()
    })
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(202)
    const body = JSON.parse(output.body)
    expect(body.body.status).to.equal('Initiated')
  })
  it('should trigger the download of a new file later (if not present)', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    const eventBody = localFixture('handleFeedlyEvent-200-OK.json')
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    eventBody.backgroundMode = 1
    event.body = JSON.stringify(eventBody)
    sinon.stub(DynamoDB, 'updateItem').resolves({})
    sinon.stub(DynamoDB, 'query').resolves(localFixture('query-204-NoContent.json'))
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(202)
    const body = JSON.parse(output.body)
    expect(body.body.status).to.equal('Accepted')
  })
  it('should dispatch a message to the users device (if the file already exists)', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    sinon.stub(DynamoDB, 'updateItem').resolves({})
    sinon.stub(DynamoDB, 'query').resolves(localFixture('query-200-OK.json'))
    sinon.stub(SQS, 'sendMessage').resolves({
      MD5OfMessageBody: '44dd2fc26e4186dc12b8e67ccb9a9435',
      MD5OfMessageAttributes: 'e95833d661f4007f9575877843f475ed',
      MessageId: 'e990c66f-23f6-4982-9274-a5a533ceb6dc'
    })
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-200-OK.json'))
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body.status).to.equal('Dispatched')
  })
  it('should fail gracefully if the startExecution fails', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-200-OK.json'))
    sinon.stub(DynamoDB, 'updateItem').rejects('Error')
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(500)
  })
  it('should handle an invalid request body', async () => {
    event.body = JSON.stringify({})
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).to.have.property('articleURL')
    expect(body.error.message.articleURL[0]).to.have.string('is required')
  })
  it('should handle a missing user ID', async () => {
    event.requestContext.authorizer!.principalId = 'unknown'
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-200-OK.json'))
    expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
  })
  it('should handle an invalid event body', async () => {
    event.body = 'hello'
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.code).to.equal('custom-4XX-generic')
    expect(body.error.message).to.equal('Request body must be valid JSON')
  })
  it('should handle an invalid (non-YouTube) URL', async () => {
    event.body = JSON.stringify(localFixture('handleFeedlyEvent-400-InvalidURL.json'))
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).to.have.property('articleURL')
    expect(body.error.message.articleURL[0]).to.have.string('not a valid YouTube URL')
  })
})
