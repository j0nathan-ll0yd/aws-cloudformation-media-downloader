import * as ytdl from 'ytdl-core'
import {videoInfo} from 'ytdl-core'
import {logDebug} from '../../util/lambda-helpers'

export async function fetchVideoInfo(uri): Promise<videoInfo> {
  try {
    logDebug("fetchVideoInfo =>")
    const data = await ytdl.getInfo(uri)
    logDebug("fetchVideoInfo <=")
    return data
  } catch (error) {
    throw new Error(error)
  }
}

export function chooseFormat(info, options) {
  return ytdl.chooseFormat(info.formats, options)
}