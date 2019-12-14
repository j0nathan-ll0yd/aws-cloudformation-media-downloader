import * as ytdl from 'ytdl-core'
import {videoInfo} from 'ytdl-core'

export function fetchVideoInfo(uri): Promise<videoInfo> {
    return new Promise(async (resolve, reject) => {
        try {
            console.info('fetchVideoInfo. ytdl.getInfo ==>')
            const info = await ytdl.getInfo(uri)
            console.info('fetchVideoInfo. ytdl.getInfo <==', JSON.stringify(info, null, 2))
            resolve(info)
        } catch (error) {
            console.error('fetchVideoInfo error => ', JSON.stringify(error, null, 2))
            reject(error)
        }
    })
}

export function chooseFormat(info, options) {
    return ytdl.chooseFormat(info.formats, options)
}
