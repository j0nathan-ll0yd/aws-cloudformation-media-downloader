import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB.js'
import * as SNS from '../../../lib/vendor/AWS/SNS.js'
import {getFixture} from '../../../util/mocha-setup.js'
import * as chai from 'chai'
import {handler} from '../src/index.js'
import {SQSEvent} from 'aws-lambda'
import {UnexpectedError} from '../../../util/errors.js'
import {v4 as uuidv4} from 'uuid'
const expect = chai.expect
import path from 'path'
import {fileURLToPath} from 'url'
import {ScanOutput} from '@aws-sdk/client-dynamodb'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const localFixture = getFixture.bind(null, __dirname)
const fakeUserId = uuidv4()
const fakeDeviceId = uuidv4()
const getUserDevicesByUserIdResponse = {
  Items: [
    {
      devices: new Set([fakeDeviceId]),
      userId: fakeUserId
    }
  ],
  Count: 1,
  ScannedCount: 1
} as unknown as ScanOutput

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
} as unknown as ScanOutput

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
