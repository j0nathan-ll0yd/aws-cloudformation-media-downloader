import {CustomAuthorizerEvent} from 'aws-lambda'
import * as AWS from 'aws-sdk'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {expect} from 'chai'
import * as crypto from 'crypto'
import * as sinon from 'sinon'
import {handleAuthorization, uploadFilePart} from '../src/main'
import {CompleteFileUploadEvent, UploadPartEvent} from '../src/types/main'
import * as ApiGateway from './../dist/lib/vendor/AWS/ApiGateway'
import * as S3 from './../dist/lib/vendor/AWS/S3'

const bucket = 'lifegames-fileviewer-s3bucket-yqm2cswg5ozl'
const key = '20191107-[sxephil]-Title'
const uploadId = 'some-id1'
const url = 'https://example.com/some-video.mp4'
const partSize = 5242880

// setup mocks for axios
const mock = new MockAdapter(axios)

// setup mocks for S3 to mock uploadPart behavior
sinon.stub(S3, 'uploadPart').returns({
    ETag: crypto.createHash('md5').update('some_string').digest('hex')
})

sinon.stub(ApiGateway, 'getApiKeys').returns({
    items: [
        {
            createdDate: '2019-07-23T17:24:49.000Z',
            description: 'The key for the iOS App',
            enabled: true,
            id: 'yzr34xwmb0',
            lastUpdatedDate: '2019-07-23T17:24:49.000Z',
            name: 'iOSAppKey',
            stageKeys: [],
            value: 'pRauC0NteI2XM5zSLgDzDaROosvnk1kF1H0ID2zc'
        }
    ]
})

sinon.stub(ApiGateway, 'getUsagePlans').returns({
    items: [
        {
            apiStages: [
                {
                    apiId: 'zc21p8daqc',
                    stage: 'Prod'
                }
            ],
            description: 'Internal consumption',
            id: 'fujp25',
            name: 'Basic'
        }
    ]
})

sinon.stub(ApiGateway, 'getUsage').returns({
    endDate: '2019-11-23',
    items: {
        yzr34xwmb0: [[2, 0]]
    },
    startDate: '2019-11-23',
    usagePlanId: 'fujp25'
})

function mockResponseUploadPart(config, bytesTotal) {
    return new Promise<any[]>((resolve, reject) => {
        const [, beg, end] = /bytes=(\d+)\-(\d+)/.exec(config.headers['Range'])
        return resolve([206, 'hello', {
            'accept-ranges': 'bytes',
            'content-length': partSize,
            'content-range': `bytes ${beg}-${end}/${bytesTotal}`,
            'content-type': 'video/mp4'
        }])
    })
}

async function mockIterationsOfUploadPart(bytesTotal) {
    return new Promise<any[]>(async (resolve, reject) => {
        const responses = []
        const partTags = []
        let partNumber = 1
        let bytesRemaining = bytesTotal
        let partEnd = Math.min(partSize, bytesTotal) - 1
        let partBeg = 0
        while (bytesRemaining > 0) {
            // tslint:disable-next-line:max-line-length
            const event: UploadPartEvent = {bucket, bytesRemaining, bytesTotal, key, partBeg, partEnd, partNumber, partSize, partTags, uploadId, url}
            const output: CompleteFileUploadEvent|UploadPartEvent = await uploadFilePart(event)
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

/*
const response = {
            context: {},
            policyDocument: {
                Statement: [{
                        Action: 'execute-api:Invoke',
                        Effect: 'Allow',
                        Resource: 'arn:aws:execute-api:us-west-2:203465012143:zc21p8daqc/Prod/POST/feedly'
                }],
                Version: '2012-10-17'
            },
            principalId: 'me',
            usageIdentifierKey: 'pRauC0NteI2XM5zSLgDzDaROosvnk1kF1H0ID2zc'
        }
 */
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
        it('should accept a valid request', async () => {
            const apiKey = 'pRauC0NteI2XM5zSLgDzDaROosvnk1kF1H0ID2zc'
            const event: CustomAuthorizerEvent = {
                methodArn: 'string',
                queryStringParameters: {ApiKey: apiKey},
                type: 'test'
            }
            const output = await handleAuthorization(event)
            expect(output.principalId).to.equal('me')
            // @ts-ignore
            expect(output.policyDocument.Statement[0].Effect).to.equal('Allow')
            expect(output.usageIdentifierKey).to.equal(apiKey)
        })
        it('should deny an invalid ApiKey', async () => {
            const apiKey = '1234'
            const event: CustomAuthorizerEvent = {
                methodArn: 'string',
                queryStringParameters: {ApiKey: apiKey},
                type: 'test'
            }
            const output = await handleAuthorization(event)
            expect(output.principalId).to.equal('me')
            // @ts-ignore
            expect(output.policyDocument.Statement[0].Effect).to.equal('Deny')
        })
    })
    /*
    describe('#uploadPart', () => {
        afterEach(() => {
            mock.resetHandlers()
        })
        it('should handle a multipart file', async () => {
            const bytesTotal = 82784319
            mock.onAny().reply((config) => mockResponseUploadPart(config, bytesTotal))
            const totalParts = Math.round(bytesTotal / partSize)
            const responses = await mockIterationsOfUploadPart(bytesTotal)
            const finalPart = responses.pop()
            const uploadPart = responses.pop()
            expect(uploadPart.partNumber).to.equal(totalParts)
            expect(finalPart.partTags.length).to.equal(totalParts)
            expect(finalPart.bytesRemaining).to.equal(0)

        })
        it('should handle a single part file', async () => {
            const bytesTotal = 5242880 - 1000
            mock.onAny().reply((config) => mockResponseUploadPart(config, bytesTotal))
            const totalParts = Math.round(bytesTotal / partSize)
            const responses = await mockIterationsOfUploadPart(bytesTotal)
            expect(responses.length).to.equal(totalParts)
            const finalPart = responses.pop()
            expect(finalPart.partTags.length).to.equal(totalParts)
            expect(finalPart.bytesRemaining).to.equal(0)
        })
    })
    */
})
