import * as AWS from 'aws-sdk'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {expect} from 'chai'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as sinon from 'sinon'
import {uploadFilePart} from '../dist/main'
import {UploadPartEvent} from '../src/types/main'
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

describe('main', () => {
    before(() => {
        /*
        sinon.stub(console, 'log')
        sinon.stub(console, 'info')
        sinon.stub(console, 'debug')
        sinon.stub(console, 'warn')
        sinon.stub(console, 'error')
        */
    })
    describe('#uploadPart', () => {
        it('should handle a multipart file', async () => {
            const bytesTotal = 82784319
            mock.onAny().reply((config) => mockResponseUploadPart(config, bytesTotal))

            const totalParts = Math.round(bytesTotal / partSize)
            const partTags = []
            let partNumber = 1
            let bytesRemaining = bytesTotal
            let partEnd = partSize - 1
            let partBeg = 0
            const responses = []
            while (bytesRemaining > 0) {
                // tslint:disable-next-line:max-line-length
                const event: UploadPartEvent = {bucket, bytesRemaining, bytesTotal, key, partBeg, partEnd, partNumber, partSize, partTags, uploadId, url}
                const response = await uploadFilePart(event)
                responses.push(response)
                if (response.bytesRemaining > 0) {
                    ({partBeg, partEnd, partNumber} = response)
                }
                bytesRemaining = response.bytesRemaining
            }

            const finalPart = responses.pop()
            const uploadPart = responses.pop()
            expect(uploadPart.partNumber).to.equal(totalParts)
            expect(finalPart.partTags.length).to.equal(totalParts)
            expect(finalPart.bytesRemaining).to.equal(0)

        })
    })
})
