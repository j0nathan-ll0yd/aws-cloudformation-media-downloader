import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as SNS from '../../../lib/vendor/AWS/SNS'
import {getFixture} from '../../../util/mocha-setup'
import * as chai from 'chai'
import {handler} from '../src'
import {SQSEvent} from 'aws-lambda'
import {UnexpectedError} from '../../../util/errors'
import {v4 as uuidv4} from 'uuid'
import * as AWS from 'aws-sdk'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)
const fakeUserId = uuidv4()
const fakeDeviceId = uuidv4()

const docClient = new AWS.DynamoDB.DocumentClient()
const getUserDevicesByUserIdResponse = {
  Items: [
    {
      devices: docClient.createSet([fakeDeviceId]),
      userId: fakeUserId
    }
  ],
  Count: 1,
  ScannedCount: 1
}

const getDeviceResponse = {
  Items: [
    {
      deviceId: fakeDeviceId,
      token: '6a077fd0efd36259b475f9d39997047eebbe45e1d197eed7d64f39d6643c7c23',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:203465012143:endpoint/APNS_SANDBOX/OfflineMediaDownloader/3447299f-275f-329f-b71f-d1f6945033ba',
      systemVersion: '15.6.1',
      name: "Programmer's iPhone"
    }
  ],
  Count: 1,
  ScannedCount: 1
}

describe('#SendPushNotification', () => {
  let event: SQSEvent
  beforeEach(() => {
    event = localFixture('SQSEvent.json') as SQSEvent
  })
  afterEach(() => {
    sinon.restore()
  })
  it('should send a notification for each user device', async () => {
    const queryStub = sinon.stub(DynamoDB, 'query')
    queryStub.onCall(0).resolves(getUserDevicesByUserIdResponse)
    queryStub.onCall(1).resolves(getDeviceResponse)
    sinon.stub(SNS, 'publishSnsEvent').resolves(localFixture('publishSnsEvent-200-OK.json'))
    const notificationsSent = await handler(event)
    // tslint:disable-next-line:no-unused-expression
    expect(notificationsSent).to.be.undefined
  })
  it('should exit gracefully if no devices exist', async () => {
    const publishSnsEventStub = sinon.stub(SNS, 'publishSnsEvent')
    sinon.stub(DynamoDB, 'query').resolves({
      Items: [],
      Count: 0,
      ScannedCount: 0
    })
    const notificationsSent = await handler(event)
    expect(notificationsSent).to.be.undefined
    expect(publishSnsEventStub.notCalled)
  })
  it('should exit if its a different notification type', async () => {
    const publishSnsEventStub = sinon.stub(SNS, 'publishSnsEvent')
    const modifiedEvent = event
    modifiedEvent.Records[0].body = 'OtherNotification'
    const notificationsSent = await handler(modifiedEvent)
    expect(notificationsSent).to.be.undefined
    expect(publishSnsEventStub.notCalled)
  })
  describe('#AWSFailure', () => {
    it('AWS.DynamoDB.DocumentClient.query.getUserDevicesByUserId', async () => {
      sinon.stub(DynamoDB, 'query').resolves(undefined)
      expect(handler(event)).to.be.rejectedWith(UnexpectedError)
    })
    it('AWS.DynamoDB.DocumentClient.query.getDevice = ', async () => {
      const queryStub = sinon.stub(DynamoDB, 'query')
      queryStub.onCall(0).resolves(getUserDevicesByUserIdResponse)
      queryStub.onCall(1).resolves(undefined)
      expect(handler(event)).to.be.rejectedWith(UnexpectedError)
    })
  })
})
