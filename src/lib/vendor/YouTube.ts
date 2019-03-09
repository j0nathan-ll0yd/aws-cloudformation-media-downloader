
// noinspection SpellCheckingInspection
import {Readable} from 'stream'
import * as ytdl from 'ytdl-core'
import {videoInfo} from 'ytdl-core'
import {Metadata} from '../../types/main'

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

export function filterFormats(info, filter) {
    return ytdl.filterFormats(info.formats, filter)
}

export function chooseFormat(info, options) {
    return ytdl.chooseFormat(info.formats, options)
}

export function fetchVideo(uri, options): Readable {
    return ytdl(uri, options)
}
