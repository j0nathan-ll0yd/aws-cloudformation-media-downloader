import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import crypto from 'crypto'
import * as sinon from 'sinon'
import {createMultipartUpload, listObjects} from '../src/lib/vendor/AWS/S3'
import {createPlatformEndpoint} from '../src/lib/vendor/AWS/SNS'
import {
  completeFileUpload,
  fileUploadWebhook,
  handleAuthorization,
  handleDeviceRegistration,
  handleFeedlyEvent, handleLoginUser, handleRegisterUser,
  listFiles, schedulerFileCoordinator,
  startFileUpload
} from '../src/main'
import {validateAuthCodeForToken, verifyAppleToken} from '../src/util/secretsmanager-helpers'
import * as ApiGateway from './../src/lib/vendor/AWS/ApiGateway'
import * as DynamoDB from './../src/lib/vendor/AWS/DynamoDB'
import * as S3 from './../src/lib/vendor/AWS/S3'
import * as SNS from './../src/lib/vendor/AWS/SNS'
import * as StepFunctions from './../src/lib/vendor/AWS/StepFunctions'
import * as YouTube from './../src/lib/vendor/YouTube'
import {getFixture, mockIterationsOfUploadPart, mockResponseUploadPart} from './helper'

const mock = new MockAdapter(axios)
chai.use(chaiAsPromised)
const expect = chai.expect

describe('main', () => {
  const partSize = 1024 * 1024 * 5
  let fakeJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
  fakeJWT += '.eyJ1c2VySWQiOiIwMDAxODUuNzcyMDMxNTU3MGZjNDlkOTlhMjY1ZjlhZjRiNDY4NzkuMjAzNCJ9'
  fakeJWT += '.wtotJzwuBIEHfBZssiA18NNObn70s9hk-M_ClRMXc8M'
  beforeEach(() => {
    this.consoleLogStub = sinon.stub(console, 'log')
    this.consoleInfoStub = sinon.stub(console, 'info')
    this.consoleDebugStub = sinon.stub(console, 'debug')
    this.consoleWarnStub = sinon.stub(console, 'warn')
    this.consoleErrorStub = sinon.stub(console, 'error')
  })
  afterEach(() => {
    this.consoleLogStub.restore()
    this.consoleInfoStub.restore()
    this.consoleDebugStub.restore()
    this.consoleWarnStub.restore()
    this.consoleErrorStub.restore()
  })
  describe('#handleAuthorization', () => {
    const validApiKey = 'pRauC0NteI2XM5zSLgDzDaROosvnk1kF1H0ID2zc'
    const baseEvent = {
      methodArn: 'arn:aws:execute-api:us-west-2:203465012143:zc21p8daqc/Prod/POST/feedly',
      queryStringParameters: {},
      type: 'REQUEST'
    }
    let getApiKeyStub
    beforeEach(() => {
      getApiKeyStub = sinon.stub(ApiGateway, 'getApiKeys')
      this.getUsagePlansStub = sinon.stub(ApiGateway, 'getUsagePlans').returns(getFixture('getUsagePlans-200-OK.json'))
      this.getUsageStub = sinon.stub(ApiGateway, 'getUsage').returns(getFixture('getUsage-200-OK.json'))
    })
    afterEach(() => {
      getApiKeyStub.restore()
      this.getUsagePlansStub.restore()
      this.getUsageStub.restore()
    })
    it('should accept a valid request', async () => {
      getApiKeyStub.returns(getFixture('getApiKeys-200-OK.json'))
      const event = baseEvent
      event.queryStringParameters = {ApiKey: validApiKey}
      const output = await handleAuthorization(event)
      expect(output.principalId).to.equal('me')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Allow')
      expect(output.usageIdentifierKey).to.equal(validApiKey)
    })
    it('should deny an invalid ApiKey', async () => {
      getApiKeyStub.returns(getFixture('getApiKeys-200-OK.json'))
      const event = baseEvent
      event.queryStringParameters = {ApiKey: 1234}
      const output = await handleAuthorization(event)
      expect(output.principalId).to.equal('me')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Deny')
    })
    it('should deny a disabled ApiKey', async () => {
      getApiKeyStub.returns(getFixture('getApiKeys-400-DisabledKey.json'))
      const event = baseEvent
      event.queryStringParameters = {ApiKey: validApiKey}
      const output = await handleAuthorization(event)
      expect(output.principalId).to.equal('me')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Deny')
    })
    it('should deny if an error occurs', async () => {
      getApiKeyStub.rejects('Error')
      const event = baseEvent
      event.queryStringParameters = {ApiKey: validApiKey}
      const output = await handleAuthorization(event)
      expect(output.principalId).to.equal('me')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Deny')
    })
  })
  describe('#uploadPart', () => {
    let uploadPartStub
    beforeEach(() => {
      uploadPartStub = sinon.stub(S3, 'uploadPart').resolves({
        ETag: crypto.createHash('md5').update('some_string').digest('hex')
      })
    })
    afterEach(() => {
      mock.resetHandlers()
      uploadPartStub.restore()
    })
    it('should handle a multipart file', async () => {
      const bytesTotal = 82784319
      mock.onAny().reply((config) => mockResponseUploadPart(config, bytesTotal, partSize))
      const totalParts = Math.round(bytesTotal / partSize)
      const responses = await mockIterationsOfUploadPart(bytesTotal, partSize)
      const finalPart = responses.pop()
      const uploadPart = responses.pop()
      expect(uploadPart.partNumber).to.equal(totalParts)
      expect(finalPart.partTags.length).to.equal(totalParts)
      expect(finalPart.bytesRemaining).to.equal(0)
    })
    it('should handle a single part file', async () => {
      const bytesTotal = 5242880 - 1000
      mock.onAny().reply((config) => mockResponseUploadPart(config, bytesTotal, partSize))
      const totalParts = Math.round(bytesTotal / partSize)
      const responses = await mockIterationsOfUploadPart(bytesTotal, partSize)
      expect(responses.length).to.equal(totalParts)
      const finalPart = responses.pop()
      expect(finalPart.partTags.length).to.equal(totalParts)
      expect(finalPart.bytesRemaining).to.equal(0)
    })
    it('should gracefully handle a failure', async () => {
      const bytesTotal = 5242880 - 1000
      mock.onAny().networkError()
      expect(mockIterationsOfUploadPart(bytesTotal, partSize)).to.be.rejectedWith(`Network Error`)
    })
  })
  describe('#handleFeedlyEvent', () => {
    const context = getFixture('handleFeedlyEvent/Context.json')
    let event
    let updateItemStub
    beforeEach(() => {
      event = getFixture('handleFeedlyEvent/APIGatewayEvent.json')
      updateItemStub = sinon.stub(DynamoDB, 'updateItem')
    })
    afterEach(() => {
      mock.resetHandlers()
      event = getFixture('handleFeedlyEvent/APIGatewayEvent.json')
      updateItemStub.restore()
    })
    it('should handle a feedly event', async () => {
      event.body = JSON.stringify(getFixture('handleFeedlyEvent/handleFeedlyEvent-200-OK.json'))
      updateItemStub.returns(getFixture('handleFeedlyEvent/updateItem-202-Accepted.json'))
      const output = await handleFeedlyEvent(event, context)
      expect(output.statusCode).to.equal(202)
      const body = JSON.parse(output.body)
      expect(body.body.status).to.equal('Accepted')
    })
    it('should fail gracefully if the startExecution fails', async () => {
      event.body = JSON.stringify(getFixture('handleFeedlyEvent/handleFeedlyEvent-200-OK.json'))
      updateItemStub.rejects('Error')
      const output = await handleFeedlyEvent(event, context)
      expect(output.statusCode).to.equal(500)
    })
    it('should handle an invalid request body', async () => {
      event.body = JSON.stringify(getFixture('handleFeedlyEvent/handleFeedlyEvent-400-MissingRequired.json'))
      const output = await handleFeedlyEvent(event, context)
      expect(output.statusCode).to.equal(400)
      const body = JSON.parse(output.body)
      expect(body.error.message).to.have.property('articleURL')
      expect(body.error.message.articleURL[0]).to.have.string('is required')
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
      event.body = JSON.stringify(getFixture('handleFeedlyEvent/handleFeedlyEvent-400-InvalidURL.json'))
      const output = await handleFeedlyEvent(event, context)
      expect(output.statusCode).to.equal(400)
      const body = JSON.parse(output.body)
      expect(body.error.message).to.have.property('articleURL')
      expect(body.error.message.articleURL[0]).to.have.string('not a valid YouTube URL')
    })
  })
  describe('#handleRegisterDevice', () => {
    const context = getFixture('handleRegisterDevice/Context.json')
    let createPlatformEndpointStub
    let subscribeStub
    let event
    beforeEach(() => {
      createPlatformEndpointStub = sinon.stub(SNS, 'createPlatformEndpoint')
      subscribeStub = sinon.stub(SNS, 'subscribe')
      event = getFixture('handleRegisterDevice/APIGatewayEvent.json')
      process.env.PlatformApplicationArn = 'arn:aws:sns:region:account_id:topic:uuid'
    })
    afterEach(() => {
      mock.resetHandlers()
      createPlatformEndpointStub.restore()
      subscribeStub.restore()
      event = getFixture('handleRegisterDevice/APIGatewayEvent.json')
    })
    it('should create a new remote endpoint (for the mobile phone)', async () => {
      createPlatformEndpointStub.returns(getFixture('createPlatformEndpoint-200-OK.json'))
      subscribeStub.returns(getFixture('handleRegisterDevice/subscribe-200-OK.json'))
      const output = await handleDeviceRegistration(event, context)
      const body = JSON.parse(output.body)
      expect(output.statusCode).to.equal(201)
      expect(body.body).to.have.property('endpointArn')
    })
    it('should return a valid response if APNS is not configured', async () => {
      delete process.env.PlatformApplicationArn
      const output = await handleDeviceRegistration(event, context)
      expect(output.statusCode).to.equal(200)
      const body = JSON.parse(output.body)
      expect(body.body).to.have.property('endpointArn')
      expect(body.body.endpointArn).to.have.string('requires configuration')
    })
    it('should handle an invalid request (no token)', async () => {
      event.body = null
      const output = await handleDeviceRegistration(event, context)
      expect(output.statusCode).to.equal(400)
      const body = JSON.parse(output.body)
      expect(body.error.message).to.have.property('token')
      expect(body.error.message.token[0]).to.have.string('is required')
    })
    it('should fail gracefully if createPlatformEndpoint fails', async () => {
      createPlatformEndpointStub.rejects('Error')
      expect(handleDeviceRegistration(event, context)).to.be.rejectedWith(Error)
    })
  })
  describe('#startFileUpload', () => {
    const event = getFixture('startFileUpload-200-OK.json')
    const mockSuccessHeaders = {
      'accept-ranges': 'bytes',
      'content-length': 82784319,
      'content-type': 'video/mp4'
    }
    const createMultipartUploadResponse = getFixture('createMultipartUpload-200-OK.json')
    let createMultipartUploadStub
    beforeEach(() => {
      createMultipartUploadStub = sinon.stub(S3, 'createMultipartUpload')
      this.fetchVideoInfoStub = sinon.stub(YouTube, 'fetchVideoInfo').returns(getFixture('fetchVideoInfo-200-OK.json'))
    })
    afterEach(() => {
      createMultipartUploadStub.restore()
      this.fetchVideoInfoStub.restore()
    })
    it('should successfully handle a multipart upload', async () => {
      createMultipartUploadStub.returns(createMultipartUploadResponse)
      event.bytesTotal = mockSuccessHeaders['content-length'] = 82784319
      mock.onAny().reply(200, '', mockSuccessHeaders)
      const output = await startFileUpload(event)
      expect(output.bytesTotal).to.equal(event.bytesTotal)
      expect(output.partEnd).to.equal(partSize - 1)
      expect(output.uploadId).to.equal(createMultipartUploadResponse.UploadId)
    })
    it('should successfully handle a single part upload', async () => {
      createMultipartUploadStub.returns(createMultipartUploadResponse)
      event.bytesTotal = mockSuccessHeaders['content-length'] = 5242880 - 1000
      mock.onAny().reply(200, '', mockSuccessHeaders)
      const output = await startFileUpload(event)
      expect(output.bytesTotal).to.equal(event.bytesTotal)
      expect(output.partEnd).to.equal(event.bytesTotal - 1)
      expect(output.uploadId).to.equal(createMultipartUploadResponse.UploadId)
    })
    it('should gracefully handle a failure', async () => {
      createMultipartUploadStub.rejects('Error')
      expect(startFileUpload(event)).to.be.rejectedWith(Error)
    })
  })
  describe('#completeFileUpload', () => {
    const event = getFixture('completeFileUpload-200-OK.json')
    const completeMultipartUploadResponse = getFixture('completeMultipartUpload-200-OK.json')
    const updateItemResponse = getFixture('updateItem-200-OK.json')
    let completeMultipartUploadStub
    let updateItemStub
    beforeEach(() => {
      completeMultipartUploadStub = sinon.stub(S3, 'completeMultipartUpload')
      updateItemStub = sinon.stub(DynamoDB, 'updateItem')
    })
    afterEach(() => {
      completeMultipartUploadStub.restore()
      updateItemStub.restore()
    })
    it('should successfully handle a multipart upload', async () => {
      updateItemStub.returns(updateItemResponse)
      completeMultipartUploadStub.returns(completeMultipartUploadResponse)
      const output = await completeFileUpload(event)
      expect(output).to.have.all.keys('Location', 'Bucket', 'Key', 'ETag')
    })
    it('should gracefully handle a failure', async () => {
      const error = new Error()
      error.name = 'EntityTooSmall'
      error.message = 'Your proposed upload is smaller than the minimum allowed size'
      completeMultipartUploadStub.rejects(error)
      expect(completeFileUpload(event)).to.be.rejectedWith(`${error.name}: ${error.message}`)
    })
  })
  describe('#listFiles', () => {
    const context = getFixture('listFiles/Context.json')
    let event
    let listObjectsStub
    beforeEach(() => {
      event = getFixture('listFiles/APIGatewayEvent.json')
      listObjectsStub = sinon.stub(S3, 'listObjects')
    })
    afterEach(() => {
      mock.resetHandlers()
      event = getFixture('listFiles/APIGatewayEvent.json')
      listObjectsStub.restore()
    })
    it('should list files, if present', async () => {
      listObjectsStub.returns(getFixture('listObjects-200-OK.json'))
      const output = await listFiles(event, context)
      expect(output.statusCode).to.equal(200)
      const body = JSON.parse(output.body)
      expect(body.body).to.have.all.keys('isTruncated', 'contents', 'name', 'prefix', 'maxKeys', 'keyCount', 'commonPrefixes')
      expect(body.body.keyCount).to.equal(1)
      expect(body.body.contents[0]).to.have.property('fileUrl').that.is.a('string')
    })
    it('should gracefully handle an empty list', async () => {
      listObjectsStub.returns(getFixture('listObjects-200-Empty.json'))
      const output = await listFiles(event, context)
      expect(output.statusCode).to.equal(200)
      const body = JSON.parse(output.body)
      expect(body.body).to.have.all.keys('isTruncated', 'contents', 'name', 'prefix', 'maxKeys', 'keyCount', 'commonPrefixes')
      expect(body.body.keyCount).to.equal(0)
    })
    it('should fail gracefully if listObjects fails', async () => {
      listObjectsStub.rejects('Error')
      expect(listFiles(event, context)).to.be.rejectedWith(Error)
    })
  })
  describe('#fileUploadWebhook', () => {
    const event = getFixture('fileUploadWebhook/Event.json')
    let publishSnsEventStub
    beforeEach(() => {
      publishSnsEventStub = sinon.stub(SNS, 'publishSnsEvent')
    })
    afterEach(() => {
      mock.resetHandlers()
      publishSnsEventStub.restore()
    })
    it('should publish the event to the topic', async () => {
      publishSnsEventStub.returns(getFixture('fileUploadWebhook/publishSnsEvent-200-OK.json'))
      const output = await fileUploadWebhook(event)
      expect(output).to.have.all.keys('messageId')
    })
    it('should handle an invalid parameter', async () => {
      publishSnsEventStub.rejects('Error')
      expect(fileUploadWebhook(event)).to.be.rejectedWith(Error)
    })
  })
  describe('#schedulerFileCoordinator', () => {
    process.env.DynamoDBTable = 'Files' // set in the cloudformation file
    const context = getFixture('schedulerFileCoordinator/Context.json')
    const event = getFixture('schedulerFileCoordinator/APIGatewayEvent.json')
    let scanStub
    let startExecutionStub
    beforeEach(() => {
      scanStub = sinon.stub(DynamoDB, 'scan')
      startExecutionStub = sinon.stub(StepFunctions, 'startExecution')
    })
    afterEach(() => {
      mock.resetHandlers()
      scanStub.restore()
      startExecutionStub.restore()
    })
    it('should handle scheduled event (with no events)', async () => {
      scanStub.returns(getFixture('schedulerFileCoordinator/scan-204-NoContent.json'))
      startExecutionStub.returns(getFixture('schedulerFileCoordinator/startExecution-200-OK.json'))
      const output = await schedulerFileCoordinator(event, context)
      expect(output.statusCode).to.equal(200)
      expect(startExecutionStub.callCount).to.equal(0)
    })
    it('should handle scheduled event (with 1 event)', async () => {
      scanStub.returns(getFixture('schedulerFileCoordinator/scan-200-OK.json'))
      startExecutionStub.returns(getFixture('schedulerFileCoordinator/startExecution-200-OK.json'))
      const output = await schedulerFileCoordinator(event, context)
      expect(output.statusCode).to.equal(200)
      expect(startExecutionStub.callCount).to.equal(1)
    })
  })
  describe('#handleRegisterUser', () => {
    const event = getFixture('handleRegisterUser/APIGatewayEvent.json')
    const context = getFixture('handleRegisterUser/Context.json')
    const dependencyModule = require('../src/util/secretsmanager-helpers')
    let createAccessTokenStub
    let putItemStub
    let validateAuthCodeForTokenStub
    let verifyAppleTokenStub
    beforeEach(() => {
      createAccessTokenStub = sinon.stub(dependencyModule, 'createAccessToken')
        .returns('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMDAxODUuNzcyMDMxNTU3MGZjNDlkOTlhMjY1ZjlhZjRiNDY4NzkuMjAzNCJ9.wtotJzwuBIEHfBZssiA18NNObn70s9hk-M_ClRMXc8M')
      putItemStub = sinon.stub(DynamoDB, 'putItem').returns(getFixture('handleRegisterUser/putItem-200-OK.json'))
      validateAuthCodeForTokenStub = sinon.stub(dependencyModule, 'validateAuthCodeForToken')
        .returns(getFixture('handleRegisterUser/validateAuthCodeForToken-200-OK.json'))
      verifyAppleTokenStub = sinon.stub(dependencyModule, 'verifyAppleToken')
        .returns(getFixture('handleRegisterUser/verifyAppleToken-200-OK.json'))
    })
    afterEach(() => {
      createAccessTokenStub.restore()
      putItemStub.restore()
      validateAuthCodeForTokenStub.restore()
      verifyAppleTokenStub.restore()
    })
    it('should successfully handle a multipart upload', async () => {
      const mockResponse = getFixture('handleRegisterUser/axios-200-OK.json')
      mock.onAny().reply(200, mockResponse)
      const output = await handleRegisterUser(event, context)
      expect(output.statusCode).to.equal(200)
      const body = JSON.parse(output.body)
      expect(body.body.token).to.be.a('string')
    })
  })
  describe('#handleLoginUser', () => {
    const event = getFixture('handleRegisterUser/APIGatewayEvent.json')
    const context = getFixture('handleRegisterUser/Context.json')
    const dependencyModule = require('../src/util/secretsmanager-helpers')
    let createAccessTokenStub
    beforeEach(() => {
      createAccessTokenStub = sinon.stub(dependencyModule, 'createAccessToken')
        .returns(fakeJWT)
    })
    afterEach(() => {
      createAccessTokenStub.restore()
    })
    it('should successfully login a user', async () => {
      const mockResponse = getFixture('handleRegisterUser/axios-200-OK.json')
      mock.onAny().reply(200, mockResponse)
      const output = await handleLoginUser(event, context)
      expect(output.statusCode).to.equal(200)
      const body = JSON.parse(output.body)
      expect(body.body.token).to.be.a('string')
    })
  })
})
