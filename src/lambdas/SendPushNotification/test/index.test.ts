import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as SNS from '../../../lib/vendor/AWS/SNS'
import {getFixture} from '../../../util/mocha-setup'
import * as chai from 'chai'
import {handler} from '../src'
import {SQSEvent} from 'aws-lambda'
import {PublishResponse} from 'aws-sdk/clients/sns'
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client'
import {UnexpectedError} from '../../../util/errors'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#SendPushNotification', () => {
  let event: SQSEvent
  let publishSnsEventStub: sinon.SinonStub
  let queryStub: sinon.SinonStub
  beforeEach(() => {
    event = localFixture('SQSEvent.json') as SQSEvent
    publishSnsEventStub = sinon.stub(SNS, 'publishSnsEvent').returns(localFixture('publishSnsEvent-200-OK.json') as Promise<PublishResponse>)
    queryStub = sinon.stub(DynamoDB, 'query').returns(localFixture('query-200-OK.json') as Promise<DocumentClient.QueryOutput>)
  })
  afterEach(() => {
    publishSnsEventStub.restore()
    queryStub.restore()
  })
  it('should send a notification for each user device', async () => {
    const notificationsSent = await handler(event)
    // tslint:disable-next-line:no-unused-expression
    expect(notificationsSent).to.be.undefined
  })
  it('should exit gracefully if no devices exist', async () => {
    queryStub.returns({
      Items: [],
      Count: 0,
      ScannedCount: 0
    })
    const notificationsSent = await handler(event)
    expect(notificationsSent).to.be.undefined
    expect(publishSnsEventStub.notCalled)
  })
  it('should exit if its a different notification type', async () => {
    const modifiedEvent = event
    modifiedEvent.Records[0].body = 'OtherNotification'
    const notificationsSent = await handler(modifiedEvent)
    expect(notificationsSent).to.be.undefined
    expect(publishSnsEventStub.notCalled)
  })
  describe('#AWSFailure', () => {
    it('AWS.DynamoDB.DocumentClient.scan', async () => {
      queryStub.returns(undefined)
      expect(handler(event)).to.be.rejectedWith(UnexpectedError)
    })
  })
})
