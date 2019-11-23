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

describe('#uploadPart', () => {
    it('should handle a multipart file', async () => {
        const bytesTotal = 82784319

        mock.onAny().reply((config) => {
            console.log(JSON.stringify(config))
            return new Promise((resolve, reject) => {
                const [, beg, end] = /bytes=(\d+)\-(\d+)/.exec(config.headers['Range'])
                resolve([206, 'hello', {
                    'accept-ranges': 'bytes',
                    'content-length': partSize,
                    'content-range': `bytes ${beg}-${end}/${bytesTotal}`,
                    'content-type': 'video/mp4'
                }])
            })
        })

        const totalParts = Math.round(bytesTotal / partSize)
        const partTags = []
        let partNumber = 1
        let bytesRemaining = bytesTotal
        let partEnd = partSize - 1
        let partBeg = 0
        while (bytesRemaining > 0) {
            console.log(`partNumber = ${partNumber}`)
            // tslint:disable-next-line:max-line-length
            const event: UploadPartEvent = { bucket, bytesRemaining, bytesTotal, key, partBeg, partEnd, partNumber, partSize, partTags, uploadId, url }
            const response = await uploadFilePart(event)
            partEnd = response.partEnd
            partBeg = response.partBeg
            partNumber = response.partNumber
            bytesRemaining = response.bytesRemaining
        }
        //expect(partNumber).to.equal(totalParts)
        //expect(partTags).to.equal(totalParts)

        /*
        * { bucket: 'lifegames-fileviewer-s3bucket-yqm2cswg5ozl',
  bytesRemaining: 77541439,
  bytesTotal: 82784319,
  key: '20191107-[sxephil]-WOW! Youtube\'s New Adpocalypse Fight, Chris Evans, Continued Whistleblower Fallout Explained, & More.mp4',
  partBeg: 5242880,
  partEnd: 10485759,
  partNumber: 2,
  partSize: 5242880,
  partTags:
   [ { ETag: '"2672bf8a0e1aa379a67fd88e20aa4217"', PartNumber: 1 } ],
  uploadId: 'HZMIouk6BBMfzawehVs8PCOvJa1nQx_18JZI7Hfbp2S_7itDTY_ZNCxsaGEDNVqWZpmJ7i4DGPQrMPqZ4e8lKVSGmmQpMEg_idrvaqEKJxRf3Ja8IhSZFu2mNDSRrfEQ385ez.Wcvzg_jOo0gKyOonNL62PdVAqV0mqSXsDi8g8mDiGWp1jcUdtWGO897b7v',
  url: 'https://r3---sn-nx57ynls.googlevideo.com/videoplayback?expire=1573965641&ei=6XrQXaOxN8uWkwbL3pXoDQ&ip=34.213.201.56&id=o-AG1ycLbrq7fVAFV2VcR0lDDEBj-8-KLTBmy67yMLaApx&itag=22&source=youtube&requiressl=yes&mm=31%2C29&mn=sn-nx57ynls%2Csn-nx5s7n76&ms=au%2Crdu&mv=m&mvi=2&pl=12&initcwndbps=2125000&mime=video%2Fmp4&ratebypass=yes&dur=1421.270&lmt=1573302485521840&mt=1573943920&fvip=3&fexp=23842630&beids=9466585&c=WEB&txp=6535432&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cmime%2Cratebypass%2Cdur%2Clmt&sig=ALgxI2wwRQIhAL793s8a8MiCBP9xxdxmD3248g6DLks0p1sXvqx4R_X6AiBXvUIpdQOpwXA70oIkqgxMq03dzSC5EQFG1D7jjbYHdQ%3D%3D&lsparams=mm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AHylml4wRQIgH6taB16JPGAwTTSkDR5AelqQ1k-t6q18tCnudnr197QCIQDBNEdj2zhaVsVd0ET6AGiHSiY03hglSs8mOWPU6_Z7qQ%3D%3D' }
        **/

    })
})
