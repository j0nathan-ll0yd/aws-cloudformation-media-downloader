import {HttpsProxyAgent} from 'https-proxy-agent'
import {getInfo, videoInfo, chooseFormat} from 'ytdl-core'
import {logDebug, logError} from '../../util/lambda-helpers'

export async function fetchVideoInfo(uri): Promise<videoInfo> {
  logDebug('fetchVideoInfo =>')
  try {
    const info = await getInfo(uri, { requestOptions: {
      agent: new HttpsProxyAgent('http://162.223.88.228:8080'),
      maxReconnects: 10,
      maxRetries: 10,
      backoff: { inc: 100, max: 10000 }
    }})
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
