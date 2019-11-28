import * as fs from 'fs'
import {uploadFilePart} from '../src/main'

export function getFixture(file) {
    const fixturePath = './test/fixtures'
    return JSON.parse(fs.readFileSync(`${fixturePath}/${file}`, 'utf8'))
}

export function mockResponseUploadPart(config, bytesTotal, partSize) {
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

export function mockIterationsOfUploadPart(bytesTotal, partSize) {
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
