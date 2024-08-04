import ytdlCore from 'ytdl-core'
import {logDebug} from '../../util/lambda-helpers.js'
import {UnexpectedError} from '../../util/errors.js'
import {assertIsError} from '../../util/transformers.js'

export async function fetchVideoInfo(uri: string): Promise<ytdlCore.videoInfo> {
  logDebug('fetchVideoInfo =>')
  try {
    const info = await ytdlCore.getInfo(uri)
    logDebug('fetchVideoInfo <=', info)
    return info
  } catch (error) {
    assertIsError(error)
    throw new UnexpectedError(error.message)
  }
}

export function chooseVideoFormat(info: ytdlCore.videoInfo, options?: ytdlCore.chooseFormatOptions): ytdlCore.videoFormat {
  return ytdlCore.chooseFormat(info.formats, options)
}

export function getVideoID(url: string): string {
  return ytdlCore.getURLVideoID(url)
}
