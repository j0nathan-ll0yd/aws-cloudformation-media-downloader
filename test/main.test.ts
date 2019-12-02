import {AWSError} from 'aws-sdk'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import crypto from 'crypto'
import * as sinon from 'sinon'
import {createPlatformEndpoint} from '../src/lib/vendor/AWS/SNS'
import {completeFileUpload, handleAuthorization, handleDeviceRegistration, handleFeedlyEvent, listFiles, startFileUpload} from '../src/main'
import * as ApiGateway from './../src/lib/vendor/AWS/ApiGateway'
import {createMultipartUpload, listObjects} from './../src/lib/vendor/AWS/S3'
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
        const event = getFixture('handleFeedlyEvent/APIGatewayEvent.json')
        const context = getFixture('handleFeedlyEvent/Context.json')
        const mockSuccessHeaders = {
            'accept-ranges': 'bytes',
            'content-length': 82784319,
            'content-type': 'video/mp4'
        }
        let startExecutionStub
        beforeEach(() => {
            startExecutionStub = sinon.stub(StepFunctions, 'startExecution')
            this.fetchVideoInfoStub = sinon.stub(YouTube, 'fetchVideoInfo').returns(getFixture('fetchVideoInfo-200-OK.json'))
        })
        afterEach(() => {
            mock.resetHandlers()
            startExecutionStub.restore()
            this.fetchVideoInfoStub.restore()
        })
        it('should handle a feedly event', async () => {
            event.body = JSON.stringify(getFixture('handleFeedlyEvent-200-OK.json'))
            startExecutionStub.returns(getFixture('startExecution-200-OK.json'))
            mock.onAny().reply(200, '', mockSuccessHeaders)
            const output = await handleFeedlyEvent(event, context)
            expect(output.statusCode).to.equal(202)
        })
        it('should fail gracefully if the startExecution fails', async () => {
            event.body = JSON.stringify(getFixture('handleFeedlyEvent-200-OK.json'))
            startExecutionStub.rejects('Error')
            mock.onAny().reply(200, '', mockSuccessHeaders)
            const output = await handleFeedlyEvent(event, context)
            expect(output.statusCode).to.equal(500)
        })
        it('should handle an invalid request', async () => {
            event.body = JSON.stringify(getFixture('handleFeedlyEvent-400-MissingRequired.json'))
            const output = await handleFeedlyEvent(event, context)
            expect(output.statusCode).to.equal(400)
            const body = JSON.parse(output.body)
            expect(body.error.message).to.have.property('ArticleURL')
            expect(body.error.message.ArticleURL[0]).to.have.string('blank')
        })
        it('should handle an invalid (non-YouTube) URL', async () => {
            event.body = JSON.stringify(getFixture('handleFeedlyEvent-400-InvalidURL.json'))
            const output = await handleFeedlyEvent(event, context)
            expect(output.statusCode).to.equal(400)
            const body = JSON.parse(output.body)
            expect(body.error.message).to.have.property('ArticleURL')
            expect(body.error.message.ArticleURL[0]).to.have.string('not a valid YouTube URL')
        })
    })
    describe('#handleRegisterDevice', () => {
        const event = getFixture('handleRegisterDevice/APIGatewayEvent.json')
        const context = getFixture('handleRegisterDevice/Context.json')
        let createPlatformEndpointStub
        beforeEach(() => {
            createPlatformEndpointStub = sinon.stub(SNS, 'createPlatformEndpoint')
        })
        afterEach(() => {
            mock.resetHandlers()
            createPlatformEndpointStub.restore()
        })
        it('should create a new remote endpoint (for the mobile phone)', async () => {
            createPlatformEndpointStub.returns(getFixture('createPlatformEndpoint-200-OK.json'))
            const output = await handleDeviceRegistration(event, context)
            expect(output.statusCode).to.equal(200)
        })
        it('should handle an invalid request (no token)', async () => {
            event.body = null
            const output = await handleDeviceRegistration(event, context)
            expect(output.statusCode).to.equal(400)
            const body = JSON.parse(output.body)
            expect(body.error.message).to.have.property('Token')
            expect(body.error.message.Token[0]).to.have.string('blank')
        })
        it('should fail gracefully if createPlatformEndpoint fails', async () => {
            createPlatformEndpointStub.rejects('Error')
            expect(handleDeviceRegistration(event, context)).to.be.rejectedWith(Error)
        })
    })
    describe('#startFileUpload', () => {
        const event = getFixture('startFileUpload-200-OK.json')
        const createMultipartUploadResponse = getFixture('createMultipartUpload-200-OK.json')
        let createMultipartUploadStub
        beforeEach(() => {
            createMultipartUploadStub = sinon.stub(S3, 'createMultipartUpload')
        })
        afterEach(() => {
            createMultipartUploadStub.restore()
        })
        it('should successfully handle a multipart upload', async () => {
            createMultipartUploadStub.returns(createMultipartUploadResponse)
            event.bytesTotal = 82784319
            const output = await startFileUpload(event)
            expect(output.bytesTotal).to.equal(event.bytesTotal)
            expect(output.partEnd).to.equal(partSize - 1)
            expect(output.uploadId).to.equal(createMultipartUploadResponse.UploadId)
        })
        it('should successfully handle a single part upload', async () => {
            createMultipartUploadStub.returns(createMultipartUploadResponse)
            event.bytesTotal = 5242880 - 1000
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
        let completeMultipartUploadStub
        beforeEach(() => {
            completeMultipartUploadStub = sinon.stub(S3, 'completeMultipartUpload')
        })
        afterEach(() => {
            completeMultipartUploadStub.restore()
        })
        it('should successfully handle a multipart upload', async () => {
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
        const event = getFixture('listFiles/APIGatewayEvent.json')
        const context = getFixture('listFiles/Context.json')
        let listObjectsStub
        beforeEach(() => {
            listObjectsStub = sinon.stub(S3, 'listObjects')
        })
        afterEach(() => {
            mock.resetHandlers()
            listObjectsStub.restore()
        })
        it('should list files, if present', async () => {
            listObjectsStub.returns(getFixture('listObjects-200-OK.json'))
            const output = await listFiles(event, context)
            expect(output.statusCode).to.equal(200)
            const body = JSON.parse(output.body)
            expect(body.body).to.have.all.keys('IsTruncated', 'Contents', 'Name', 'Prefix', 'MaxKeys', 'KeyCount', 'CommonPrefixes')
            expect(body.body.KeyCount).to.equal(1)
            expect(body.body.Contents[0]).to.have.property('FileUrl').that.is.a('string')
        })
        it('should gracefully handle an empty list', async () => {
            listObjectsStub.returns(getFixture('listObjects-200-Empty.json'))
            const output = await listFiles(event, context)
            expect(output.statusCode).to.equal(200)
            const body = JSON.parse(output.body)
            expect(body.body).to.have.all.keys('IsTruncated', 'Contents', 'Name', 'Prefix', 'MaxKeys', 'KeyCount', 'CommonPrefixes')
            expect(body.body.KeyCount).to.equal(0)
        })
        it('should fail gracefully if listObjects fails', async () => {
            listObjectsStub.rejects('Error')
            expect(listFiles(event, context)).to.be.rejectedWith(Error)
        })
    })
})
