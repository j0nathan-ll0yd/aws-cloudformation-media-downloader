import {ScheduledEvent} from 'aws-lambda'
import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import {handler} from '../src/index'
import {fakePrivateKey, testContext} from '../../../util/mocha-setup'
import * as chai from 'chai'
import * as SecretsManagerHelper from '../../../util/secretsmanager-helpers'
const expect = chai.expect
import * as SNS from '../../../lib/vendor/AWS/SNS'
import {v4 as uuidv4} from 'uuid'
import {Apns2Error, UnexpectedError} from '../../../util/errors'
import {ApnsClient, Notification, ApnsPayload, PushType, Priority} from 'apns2'
import {ScanOutput} from '@aws-sdk/client-dynamodb'
const fakeUserId = uuidv4()
const fakeGetDevicesResponse = {
  Items: [
    {
      deviceId: 'C51C57D9-8898-4584-94D8-81D49B21EB2A',
      token: '6a077fd0efd36259b475f9d39997047eebbe45e1d197eed7d64f39d6643c7c23',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:203465012143:endpoint/APNS_SANDBOX/OfflineMediaDownloader/3447299f-275f-329f-b71f-d1f6945033ba',
      systemVersion: '15.6.1',
      name: "Programmer's iPhone"
    },
    {
      deviceId: '575A3FA3-6565-4F46-ADA3-2D2F6BD96A63',
      token: '0d0752c339fc26c467b1da4f8d3a62480463aa8ccc2f70426022c6d813deb07b',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:203465012143:endpoint/APNS_SANDBOX/OfflineMediaDownloader/3edbcde7-9985-36bb-9444-81f7a901008b',
      systemVersion: '15.6.1',
      name: "Programmer's iPhone"
    },
    {
      deviceId: '67C431DE-37D2-4BBA-9055-E9D2766517E1',
      token: '1270ac093113154918d1ae96e90247d068b98766842654b3cc2400c7342dc4ba',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:203465012143:endpoint/APNS_SANDBOX/OfflineMediaDownloader/29720d05-4add-315d-9dc0-085608820900',
      systemVersion: '16.0.3',
      name: 'iPhone'
    },
    {
      deviceId: '472BD10E-2522-4813-9DBC-54052F677DEB',
      token: '5ff44bb5b361189c1a22ebe7835a8508dbb8878b02ca333f5d3c4d62818a9069',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:203465012143:endpoint/APNS_SANDBOX/OfflineMediaDownloader/b48d0b59-9041-390e-aa93-a59e5bc3c1d8',
      systemVersion: '15.6.1',
      name: "Programmer's iPhone"
    }
  ],
  Count: 4,
  ScannedCount: 4
} as unknown as ScanOutput

const fakeUserDevicesResponse = {
  Items: [
    {
      devices: new Set(['67C431DE-37D2-4BBA-9055-E9D2766517E1', 'C51C57D9-8898-4584-94D8-81D49B21EB2A']),
      userId: fakeUserId
    }
  ]
} as unknown as ScanOutput

const fakeApnsNotificationOptions = {
  contentAvailable: true,
  type: PushType.background,
  priority: Priority.throttled,
  aps: {
    health: 'check'
  }
}

function getExpiredResponseForDevice(arrayIndex: number): Apns2Error {
  return {
    name: 'Apns2Error',
    message: 'BadExpirationDate',
    statusCode: 410,
    reason: 'BadExpirationDate',
    notification: {
      deviceToken: fakeGetDevicesResponse.Items?.[arrayIndex].token,
      options: fakeApnsNotificationOptions,
      get pushType(): PushType {
        return PushType.background
      },
      get priority(): Priority {
        return Priority.throttled
      },
      buildApnsOptions(): ApnsPayload {
        return fakeApnsNotificationOptions
      }
    }
  } as unknown as Apns2Error
}

function getSuccessfulResponseForDevice(arrayIndex: number): Notification {
  return {
    deviceToken: fakeGetDevicesResponse.Items?.[arrayIndex].token,
    options: fakeApnsNotificationOptions,
    get pushType(): PushType {
      return PushType.background
    },
    get priority(): Priority {
      return Priority.throttled
    },
    buildApnsOptions(): ApnsPayload {
      return fakeApnsNotificationOptions
    }
  } as unknown as Notification
}

describe('#PruneDevices', () => {
  const event: ScheduledEvent = {
    'detail-type': 'Scheduled Event',
    account: '',
    detail: undefined,
    id: '',
    region: '',
    resources: [],
    source: '',
    time: '',
    version: ''
  }
  const context = testContext
  beforeEach(() => {
    sinon.stub(SecretsManagerHelper, 'getApnsSigningKey').resolves(fakePrivateKey)
  })
  afterEach(() => {
    sinon.restore()
  })
  it('should search for and remove disabled devices (single)', async () => {
    const scanStub = sinon.stub(DynamoDB, 'scan')
    scanStub.onCall(0).resolves(fakeGetDevicesResponse)
    scanStub.onCall(1).resolves(fakeUserDevicesResponse)
    sinon.stub(DynamoDB, 'deleteItem').resolves({})
    sinon.stub(DynamoDB, 'updateItem').resolves({})
    const sendStub = sinon.stub(ApnsClient.prototype, 'send')
    sendStub.onCall(0).throws(getExpiredResponseForDevice(0))
    sendStub.onCall(1).resolves(getSuccessfulResponseForDevice(1))
    sendStub.onCall(2).resolves(getSuccessfulResponseForDevice(2))
    sendStub.onCall(3).resolves(getSuccessfulResponseForDevice(3))
    sinon.stub(SNS, 'deleteEndpoint').resolves({
      ResponseMetadata: {
        RequestId: uuidv4()
      }
    })
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(200)
  })
  describe('#AWSFailure', () => {
    it('AWS.DynamoDB.scan.0', async () => {
      const scanStub = sinon.stub(DynamoDB, 'scan')
      scanStub.onCall(0).resolves(undefined)
      scanStub.onCall(1).resolves(fakeUserDevicesResponse)
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
    it('AWS.DynamoDB.scan.1', async () => {
      const scanStub = sinon.stub(DynamoDB, 'scan')
      scanStub.onCall(0).resolves(fakeGetDevicesResponse)
      scanStub.onCall(1).resolves(undefined)
      sinon.stub(ApnsClient.prototype, 'send').throws(getExpiredResponseForDevice(0))
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
  })
  describe('#APNSFailure', () => {
    it('APNS.Failure', async () => {
      sinon.stub(DynamoDB, 'scan').resolves(fakeGetDevicesResponse)
      sinon.stub(ApnsClient.prototype, 'send').throws(undefined)
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
  })
})
