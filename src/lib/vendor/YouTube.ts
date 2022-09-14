import {getInfo, videoInfo, chooseFormat, getURLVideoID, videoFormat, chooseFormatOptions} from 'ytdl-core'
import {logDebug} from '../../util/lambda-helpers'
import {UnexpectedError} from '../../util/errors'
import {assertIsError} from '../../util/transformers'

export async function fetchVideoInfo(uri: string): Promise<videoInfo> {
  logDebug('fetchVideoInfo =>')
  try {
    const info = await getInfo(uri)
    logDebug('fetchVideoInfo <=', info)
    return info
  } catch (error) {
    assertIsError(error)
    throw new UnexpectedError(error.message)
  }
}

export function chooseVideoFormat(info: videoInfo, options?: chooseFormatOptions): videoFormat {
  return chooseFormat(info.formats, options)
}

export function getVideoID(url: string): string {
  return getURLVideoID(url)
}
