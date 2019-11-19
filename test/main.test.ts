import * as AWS from 'aws-sdk'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {expect} from 'chai'
import * as fs from 'fs'
import * as sinon from 'sinon'
import {uploadFilePart} from '../dist/main'
import {UploadPartEvent} from '../src/types/main'
import * as S3 from './../dist/lib/vendor/AWS/S3'

describe('Index Test', () => {

    const mock = new MockAdapter(axios)
    const readStream = fs.createReadStream('./test/examples/short-video.mp4')
    mock.onAny().reply(200, 'hello', {
        'Content-Length': 10000
    })

    it('should always pass', async () => {
        expect(true).to.equal(true)

        const event1: UploadPartEvent = {
            bucket: 'lifegames-fileviewer-s3bucket-yqm2cswg5ozl',
            bytesRemaining: 82784319,
            bytesTotal: 82784319,
            key: '20191107-[sxephil]-Title',
            partBeg: 0,
            partEnd: 5242879,
            partNumber: 1,
            partSize: 5242880,
            partTags: [],
            uploadId: 'some-id1',
            url: 'https://example.com/some-video.mp4'
        }
        sinon.stub(S3, 'uploadPart').returns([{ name: 'org-one' }, { name: 'org-two'}])
        await uploadFilePart(event1)
    })
})
