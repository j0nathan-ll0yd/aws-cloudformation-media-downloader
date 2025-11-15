import {S3Client} from '@aws-sdk/client-s3'
import {StandardUnit} from '@aws-sdk/client-cloudwatch'
import {fetchVideoInfo, chooseVideoFormat, streamVideoToS3} from '../../../lib/vendor/YouTube'
import {StartFileUploadParams, DynamoDBFile} from '../../../types/main'
import {logDebug, logInfo, putMetric} from '../../../util/lambda-helpers'
import {assertIsError} from '../../../util/transformers'
import {UnexpectedError, CookieExpirationError} from '../../../util/errors'
import {upsertFile} from '../../../util/shared'
import {FileStatus} from '../../../types/enums'
import {createVideoDownloadFailureIssue, createCookieExpirationIssue} from '../../../util/github-helpers'

/**
 * Streams a YouTube video directly to S3 bucket
 * Uses yt-dlp to download and AWS SDK streaming upload to S3
 * @param event - Contains fileId (YouTube video ID)
 * @returns Upload result with file size and status
 * @notExported
 */
export async function handler(event: StartFileUploadParams): Promise<{
  fileId: string
  status: string
  fileSize: number
  duration: number
}> {
  logInfo('event <=', event)
  const fileId = event.fileId
  const fileUrl = `https://www.youtube.com/watch?v=${fileId}`

  try {
    // Fetch video metadata
    logDebug('fetchVideoInfo <=', fileId)
    const videoInfo = await fetchVideoInfo(fileUrl)
    const selectedFormat = chooseVideoFormat(videoInfo)

    logDebug('Selected format:', {
      formatId: selectedFormat.format_id,
      filesize: selectedFormat.filesize || 'unknown',
      ext: selectedFormat.ext,
      isStreaming: selectedFormat.url.includes('manifest') || selectedFormat.url.includes('.m3u8')
    })

    // Create DynamoDB entry with PendingDownload status
    const fileName = `${videoInfo.id}.${selectedFormat.ext}`
    const bucket = process.env.Bucket

    if (!bucket) {
      throw new UnexpectedError('Bucket environment variable not set')
    }

    const dynamoItem: DynamoDBFile = {
      fileId: videoInfo.id,
      key: fileName,
      size: selectedFormat.filesize || 0, // Will be updated after upload
      availableAt: new Date().getTime() / 1000,
      authorName: videoInfo.uploader || 'Unknown',
      authorUser: (videoInfo.uploader || 'unknown').toLowerCase().replace(/\s+/g, '_'),
      title: videoInfo.title,
      description: videoInfo.description || '',
      publishDate: videoInfo.upload_date || new Date().toISOString(),
      contentType: 'video/mp4',
      status: FileStatus.PendingDownload
    }

    await upsertFile(dynamoItem)
    logInfo('DynamoDB entry created with PendingDownload status')

    // Stream video directly to S3
    const s3Client = new S3Client({region: process.env.AWS_REGION || 'us-west-2'})
    logInfo('Starting stream upload to S3', {bucket, key: fileName})

    const uploadResult = await streamVideoToS3(
      fileUrl,
      s3Client,
      bucket,
      fileName
    )

    logInfo('Stream upload completed', uploadResult)

    // Update DynamoDB with final file size and Downloaded status
    dynamoItem.size = uploadResult.fileSize
    dynamoItem.status = FileStatus.Downloaded
    await upsertFile(dynamoItem)
    logInfo('DynamoDB entry updated with Downloaded status')

    // Publish success metric
    await putMetric('LambdaExecutionSuccess', 1, StandardUnit.Count)

    return {
      fileId: videoInfo.id,
      status: 'success',
      fileSize: uploadResult.fileSize,
      duration: uploadResult.duration
    }
  } catch (error) {
    assertIsError(error)
    logInfo('Upload failed, updating DynamoDB with Failed status')

    // Update DynamoDB with Failed status
    try {
      await upsertFile({
        fileId,
        status: FileStatus.Failed
      } as DynamoDBFile)
    } catch (updateError) {
      assertIsError(updateError)
      logInfo('Failed to update DynamoDB with Failed status:', updateError.message)
    }

    // Publish failure metric with error type dimension
    await putMetric('LambdaExecutionFailure', 1, StandardUnit.Count, [
      {Name: 'ErrorType', Value: error.constructor.name}
    ])

    // Handle cookie expiration errors specially
    if (error instanceof CookieExpirationError) {
      logInfo('Cookie expiration detected, creating specialized GitHub issue')

      // Publish cookie-specific metric
      await putMetric('CookieAuthenticationFailure', 1, StandardUnit.Count, [
        {Name: 'VideoId', Value: fileId}
      ])

      // Create specialized GitHub issue with cookie refresh instructions
      await createCookieExpirationIssue(fileId, fileUrl, error)

      throw new UnexpectedError(`Cookie expiration detected: ${error.message}`)
    }

    // Create generic GitHub issue for other video download failures
    await createVideoDownloadFailureIssue(
      fileId,
      fileUrl,
      error,
      `Video download failed during processing. Check CloudWatch logs for full details.`
    )

    throw new UnexpectedError(`File upload failed: ${error.message}`)
  }
}
