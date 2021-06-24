import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as SNS from '../../../lib/vendor/AWS/SNS'
import {getFixture} from '../../../util/mocha-setup'
import chai from 'chai'
import {handler} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#SendPushNotification', () => {
  let event
  let publishSnsEventStub
  let queryStub
  beforeEach(() => {
    event = localFixture('SQSEvent.json')
    publishSnsEventStub = sinon.stub(SNS, 'publishSnsEvent').returns(localFixture('publishSnsEvent-200-OK.json'))
    queryStub = sinon.stub(DynamoDB, 'query').returns(localFixture('query-200-OK.json'))
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
  it('should fail gracefully if query fails', async () => {
    queryStub.rejects('Error')
    expect(handler(event)).to.be.rejectedWith(Error)
  })
})
