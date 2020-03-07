import * as ytdl from 'ytdl-core'
import {videoInfo} from 'ytdl-core'

export async function fetchVideoInfo(uri): Promise<videoInfo> {
  try {
    return await ytdl.getInfo(uri)
  } catch (error) {
    throw new Error(error)
  }
}

export function chooseFormat(info, options) {
  return ytdl.chooseFormat(info.formats, options)
}