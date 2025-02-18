import {logDebug} from '../../util/lambda-helpers'
import {UnexpectedError} from '../../util/errors'
import {Metadata, YouTubeDownloaderLambdaResponse, YouTubeVideoMetadata} from '../../types/main'
import {invoke} from './AWS/Lambda'
import {InvocationType, LogType} from '@aws-sdk/client-lambda'

export async function fetchVideoInfo(uri: string): Promise<Metadata> {
  logDebug('YouTube.fetchVideoInfo =>')
  const params = {
    FunctionName: process.env.YouTubeDownloaderLambdaArn,
    InvocationType: InvocationType.RequestResponse,
    LogType: LogType.None,
    Payload: Buffer.from(JSON.stringify({uri}), 'utf8')
  }
  logDebug('YouTube.fetchVideoInfo <=', params)
  const encodedResponse = await invoke(params)
  logDebug('YouTube.fetchVideoInfo =>', encodedResponse)
  if (!encodedResponse.Payload) {
    throw new UnexpectedError('No payload returned from YouTubeDownloaderLambda')
  }
  const responseBodyString = Buffer.from(encodedResponse.Payload).toString()
  logDebug('YouTube.fetchVideoInfo =>', responseBodyString)
  const response = JSON.parse(responseBodyString) as YouTubeDownloaderLambdaResponse
  logDebug('YouTube.fetchVideoInfo =>', response)
  const info: YouTubeVideoMetadata = response.body as YouTubeVideoMetadata
  const keys = ['videoId', 'videoUrl', 'title', 'description', 'imageUri', 'ext', 'published', 'mimeType', 'uploaderId', 'uploaderName']
  for (const key of keys) {
    if (!info[key]) {
      throw new UnexpectedError(`Missing required value in videoDetails: ${key}`)
    }
  }

  const date = new Date(0)
  date.setUTCSeconds(info.published)
  const ext = info.ext
  const title = info.title
  const uploadDate = date.toISOString().substring(0, 10).replace(/-/g, '')
  const fileName = `${uploadDate}-[${info.uploaderId}].${ext}`
  const escapedTitle = title.replace(/[°()@,;:"/[\]\\?={}’]/g, '')

  const {videoId, videoUrl, description, imageUri, mimeType, published} = info

  return {
    videoId,
    videoUrl,
    fileName,
    escapedTitle,
    authorId: info.uploaderId,
    authorName: info.uploaderName,
    description,
    ext,
    imageUri,
    mimeType,
    published,
    title
  } as Metadata
}

export function getVideoID(url: string): string {
  // Affectionately stolen from: https://www.npmjs.com/package/ytdl-core
  const idRegex = /^[a-zA-Z0-9-_]{11}$/
  const validateID = (id: string) => {
    return idRegex.test(id.trim())
  }
  const validPathDomains = /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts)\/)/
  const validQueryDomains = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'gaming.youtube.com'])
  const parsed = new URL(url.trim())
  let id = parsed.searchParams.get('v')
  if (validPathDomains.test(url.trim()) && !id) {
    const paths = parsed.pathname.split('/')
    id = parsed.host === 'youtu.be' ? paths[1] : paths[2]
  } else if (parsed.hostname && !validQueryDomains.has(parsed.hostname)) {
    throw Error('Not a YouTube domain')
  }
  if (!id) {
    throw Error(`No video id found: "${url}"`)
  }
  id = id.substring(0, 11)
  if (!validateID(id)) {
    throw TypeError(`Video id (${id}) does not match expected ` + `format (${idRegex.toString()})`)
  }
  return id
}
