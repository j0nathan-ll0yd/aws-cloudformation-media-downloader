import {getInfo, videoInfo, chooseFormat, getURLVideoID} from 'ytdl-core'
import {logDebug, logError} from '../../util/lambda-helpers'

export async function fetchVideoInfo(uri): Promise<videoInfo> {
  logDebug('fetchVideoInfo =>')
  try {
    const info = await getInfo(uri)
    logDebug('fetchVideoInfo <=')
    return info
  } catch (error) {
    logError(`fetchVideoInfo <= ${error.message}`)
    throw new Error(error.message)
  }
}

export function chooseVideoFormat(info, options) {
  return chooseFormat(info.formats, options)
}

export function getVideoID(url) {
  return getURLVideoID(url)
}
