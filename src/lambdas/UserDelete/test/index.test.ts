import {APIGatewayEvent} from 'aws-lambda'
import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as SNS from '../../../lib/vendor/AWS/SNS'
import {handler} from '../src'
import {getFixture, testContext} from '../../../util/mocha-setup'
import {v4 as uuidv4} from 'uuid'
import * as AWS from 'aws-sdk'
import * as chai from 'chai'
import {UnexpectedError} from '../../../util/errors'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)
const docClient = new AWS.DynamoDB.DocumentClient()
const fakeUserId = uuidv4()
const fakeUserDevicesResponse = {
  Items: [
    {
      devices: docClient.createSet(['67C431DE-37D2-4BBA-9055-E9D2766517E1', 'C51C57D9-8898-4584-94D8-81D49B21EB2A']),
      userId: fakeUserId
    }
  ]
}
const fakeDeviceResponse1 = {
  Items: [
    {
      deviceId: '67C431DE-37D2-4BBA-9055-E9D2766517E1',
      token: 'fake-token',
      systemName: 'iOS',
      endpointArn: 'fake-endpointArn',
      systemVersion: '16.0.2',
      name: 'iPhone'
    }
  ]
}

const fakeDeviceResponse2 = {
  Items: [
    {
      deviceId: 'C51C57D9-8898-4584-94D8-81D49B21EB2A',
      token: 'fake-token',
      systemName: 'iOS',
      endpointArn: 'fake-endpointArn',
      systemVersion: '16.0.2',
      name: 'iPhone'
    }
  ]
}

/* eslint-disable  @typescript-eslint/no-non-null-assertion */
describe('#UserDelete', () => {
  let event: APIGatewayEvent
  const context = testContext
  beforeEach(() => {
    event = localFixture('APIGatewayEvent.json') as APIGatewayEvent
    event.requestContext.authorizer!.principalId = fakeUserId
  })
  afterEach(() => {
    sinon.restore()
  })
  it('should delete all user data', async () => {
    sinon.stub(DynamoDB, 'deleteItem').resolves({})
    sinon.stub(DynamoDB, 'updateItem').resolves({})
    sinon.stub(SNS, 'deleteEndpoint').resolves({
      ResponseMetadata: {
        RequestId: uuidv4()
      }
    })
    const queryStub = sinon.stub(DynamoDB, 'query')
    queryStub.onCall(0).resolves(fakeUserDevicesResponse)
    queryStub.onCall(1).resolves(fakeDeviceResponse1)
    queryStub.onCall(2).resolves(fakeDeviceResponse2)
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(204)
  })
  it('should create an issue if deletion fails', async () => {
    sinon.stub(DynamoDB, 'deleteItem').throws(new Error('Delete failed'))
    const queryStub = sinon.stub(DynamoDB, 'query')
    queryStub.onCall(0).resolves(fakeUserDevicesResponse)
    queryStub.onCall(1).resolves(fakeDeviceResponse1)
    queryStub.onCall(2).resolves(fakeDeviceResponse2)
    expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
  })
  describe('#AWSFailure', () => {
    it('AWS.DynamoDB.query.0', async () => {
      sinon.stub(DynamoDB, 'query').rejects(undefined)
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
    it('AWS.DynamoDB.query.1', async () => {
      const queryStub = sinon.stub(DynamoDB, 'query')
      queryStub.onCall(0).resolves(fakeUserDevicesResponse)
      queryStub.onCall(1).resolves({})
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
    it('AWS.ApiGateway.CustomLambdaAuthorizer', async () => {
      event.requestContext.authorizer!.principalId = 'unknown'
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
  })
})
