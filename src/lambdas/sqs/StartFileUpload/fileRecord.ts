/**
 * File Record
 *
 * Builds the permanent File entity for a video that StartFileUpload has uploaded to S3.
 */
import {CloudFrontDistributionId} from '@j0nathan-ll0yd/core'
import {getRequiredEnv} from '@j0nathan-ll0yd/env'
import type {File} from '#types/domainModels'
import {FileStatus} from '#types/enums'
import type {YtDlpVideoInfo} from '#types/youtube'

/**
 * Build the Downloaded File entity from yt-dlp metadata and the uploaded S3 object.
 *
 * @param videoInfo - Video metadata from yt-dlp
 * @param fileName - S3 object key of the uploaded video
 * @param fileSize - Size in bytes of the uploaded video
 */
export function buildDownloadedFile(videoInfo: YtDlpVideoInfo, fileName: string, fileSize: number): File {
  const cloudfrontDomain = CloudFrontDistributionId(getRequiredEnv('CLOUDFRONT_DOMAIN'))
  return {
    fileId: videoInfo.id,
    key: fileName,
    size: fileSize,
    authorName: videoInfo.uploader || 'Unknown',
    authorUser: (videoInfo.uploader || 'unknown').toLowerCase().replaceAll(/\s+/g, '_'),
    title: videoInfo.title,
    description: videoInfo.description || '',
    publishDate: videoInfo.upload_date || new Date().toISOString(),
    contentType: 'video/mp4',
    status: FileStatus.Downloaded,
    url: `https://${cloudfrontDomain}/${fileName}`,
    duration: videoInfo.duration,
    uploadDate: videoInfo.upload_date,
    viewCount: videoInfo.view_count,
    thumbnailUrl: videoInfo.thumbnail
  }
}
