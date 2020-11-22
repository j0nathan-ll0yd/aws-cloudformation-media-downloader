import axios, {AxiosRequestConfig} from 'axios'
import {videoInfo} from 'ytdl-core'
import {createMultipartUpload} from '../../../lib/vendor/AWS/S3'
import {fetchVideoInfo} from '../../../lib/vendor/YouTube'
import {Metadata, UploadPartEvent} from '../../../types/main'
import {logDebug, logError, logInfo} from '../../../util/lambda-helpers'
import {transformVideoInfoToMetadata, transformVideoIntoS3File} from '../../../util/transformers'

export async function startFileUpload(event): Promise<UploadPartEvent> {
  logInfo('event <=', event)
  const fileId = event.fileId
  const fileUrl = `https://www.youtube.com/watch?v=${fileId}`
  try {
    logDebug('fetchVideoInfo <=', fileId)
    const myVideoInfo: videoInfo = await fetchVideoInfo(fileUrl)
    logDebug('fetchVideoInfo =>', myVideoInfo)
    const myMetadata: Metadata = transformVideoInfoToMetadata(myVideoInfo)
    const myS3File = transformVideoIntoS3File(myVideoInfo, process.env.Bucket)

    const videoUrl = myMetadata.formats[0].url
    const options: AxiosRequestConfig = {
      method: 'head',
      timeout: 900000,
      url: videoUrl
    }

    logDebug('axios <= ', options)
    const fileInfo = await axios(options)
    const {status, statusText, headers, config} = fileInfo
    logDebug('axios =>', {status, statusText, headers, config})

    // TODO: Ensure these headers exist in the response
    const bytesTotal = parseInt(fileInfo.headers['content-length'], 10)
    const contentType = fileInfo.headers['content-type']
    const key = myS3File.Key
    const bucket = process.env.Bucket // sourced via template.yaml
    const partSize = 1024 * 1024 * 5
    const params = {
      ACL: 'public-read',
      Bucket: process.env.Bucket,
      ContentType: contentType,
      Key: key,
      Metadata: myS3File.Metadata
    }
    logInfo('createMultipartUpload <=', params)
    const output = await createMultipartUpload(params)
    logInfo('createMultipartUpload =>', output)
    const newPartEnd = Math.min(partSize, bytesTotal)
    return {
      bucket,
      bytesRemaining: bytesTotal,
      bytesTotal,
      fileId,
      key,
      partBeg: 0,
      partEnd: newPartEnd - 1,
      partNumber: 1,
      partSize,
      partTags: [],
      uploadId: output.UploadId,
      url: videoUrl
    } as UploadPartEvent
  } catch (error) {
    logError(`startFileUpload <= ${error.message}`)
    throw new Error(error)
  }
}
