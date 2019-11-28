import * as ytdl from 'ytdl-core'
import {videoInfo} from 'ytdl-core'

export function fetchVideoInfo(uri): Promise<videoInfo> {
    return new Promise(async (resolve, reject) => {
        try {
            const info = await ytdl.getInfo(uri)
            resolve(info)
        } catch (error) {
            reject(error)
        }
    })
}

export function chooseFormat(info, options) {
    return ytdl.chooseFormat(info.formats, options)
}
