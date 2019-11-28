import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {expect} from 'chai'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as sinon from 'sinon'
import {handleAuthorization, uploadFilePart} from '../src/main'
import * as ApiGateway from './../src/lib/vendor/AWS/ApiGateway'
import * as S3 from './../src/lib/vendor/AWS/S3'

function getFixture(file) {
    const fixturePath = './test/fixtures'
    return JSON.parse(fs.readFileSync(`${fixturePath}/${file}`, 'utf8'))
}

function mockResponseUploadPart(config, bytesTotal, partSize) {
    return new Promise<any[]>((resolve, reject) => {
        const [, beg, end] = /bytes=(\d+)\-(\d+)/.exec(config.headers.Range)
        return resolve([206, 'hello', {
            'accept-ranges': 'bytes',
            'content-length': partSize,
            'content-range': `bytes ${beg}-${end}/${bytesTotal}`,
            'content-type': 'video/mp4'
        }])
    })
}

function mockIterationsOfUploadPart(bytesTotal, partSize) {
    const bucket = 'lifegames-fileviewer-s3bucket-yqm2cswg5ozl'
    const key = '20191107-[sxephil]-Title'
    const uploadId = 'some-id1'
    const url = 'https://example.com/some-video.mp4'
    return new Promise<any[]>(async (resolve, reject) => {
        const responses = []
        const partTags = []
        let partNumber = 1
        let bytesRemaining = bytesTotal
        let partEnd = Math.min(partSize, bytesTotal) - 1
        let partBeg = 0
        while (bytesRemaining > 0) {
            const event = {bucket, bytesRemaining, bytesTotal, key, partBeg, partEnd, partNumber, partSize, partTags, uploadId, url}
            const output = await uploadFilePart(event)
            responses.push(output)
            if (output.bytesRemaining > 0) {
                // @ts-ignore
                ({partBeg, partEnd, partNumber} = output)
            }
            bytesRemaining = bytesRemaining - partSize
        }
        resolve(responses)
    })
}
describe('main', () => {
    beforeEach(() => {
        /*this.consoleLogStub = sinon.stub(console, 'log')
        this.consoleInfoStub = sinon.stub(console, 'info')
        this.consoleDebugStub = sinon.stub(console, 'debug')
        this.consoleWarnStub = sinon.stub(console, 'warn')
        this.consoleErrorStub = sinon.stub(console, 'error')*/
    })
    afterEach(() => {
        /*this.consoleLogStub.restore()
        this.consoleInfoStub.restore()
        this.consoleDebugStub.restore()
        this.consoleWarnStub.restore()
        this.consoleErrorStub.restore()*/
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
    })
    describe('#uploadPart', () => {
        const partSize = 5242880
        const mock = new MockAdapter(axios)
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
    })
})
