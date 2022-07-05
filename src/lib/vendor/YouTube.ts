import {getInfo, videoInfo, chooseFormat, getURLVideoID, videoFormat, chooseFormatOptions} from 'ytdl-core'
import {logDebug, logError} from '../../util/lambda-helpers'
import {UnexpectedError} from '../../util/errors'

export async function fetchVideoInfo(uri: string): Promise<videoInfo> {
  logDebug('fetchVideoInfo =>')
  try {
    const info = await getInfo(uri)
    logDebug('fetchVideoInfo <=')
    return info
  } catch (error) {
    logError(`fetchVideoInfo <= ${error.message}`)
    throw new UnexpectedError(error.message)
  }
}

export function chooseVideoFormat(info: videoInfo, options?: chooseFormatOptions): videoFormat {
  return chooseFormat(info.formats, options)
}

export function getVideoID(url: string): string {
  return getURLVideoID(url)
}
