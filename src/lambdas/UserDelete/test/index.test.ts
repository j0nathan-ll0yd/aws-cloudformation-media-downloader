import {APIGatewayEvent} from 'aws-lambda'
import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB.js'
import * as SNS from '../../../lib/vendor/AWS/SNS.js'
import * as GithubHelper from '../../../util/github-helpers.js'
import {handler} from '../src/index.js'
import {getFixture, testContext} from '../../../util/mocha-setup.js'
import {v4 as uuidv4} from 'uuid'
import * as chai from 'chai'
import {UnexpectedError} from '../../../util/errors.js'
const expect = chai.expect
import path from 'path'
import {fileURLToPath} from 'url'
import {QueryOutput} from '@aws-sdk/client-dynamodb'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const localFixture = getFixture.bind(null, __dirname)
const fakeUserId = uuidv4()
const fakeUserDevicesResponse = {
  Items: [
    {
      devices: new Set(['67C431DE-37D2-4BBA-9055-E9D2766517E1', 'C51C57D9-8898-4584-94D8-81D49B21EB2A']),
      userId: fakeUserId
    }
  ]
} as unknown as QueryOutput
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
} as unknown as QueryOutput

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
} as unknown as QueryOutput

const fakeGithubIssueResponse = {
  status: '201',
  url: 'https://api.github.com/repos/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues',
  headers: {},
  data: {
    id: 1679634750,
    number: 57,
    title: 'UserDelete Failed for UserId: 0f2e90e6-3c52-4d48-a6f2-5119446765f1'
  }
}

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
    sinon.stub(DynamoDB, 'updateItem').resolves({})
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    sinon.stub(GithubHelper, 'createFailedUserDeletionIssue').resolves(fakeGithubIssueResponse)
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
