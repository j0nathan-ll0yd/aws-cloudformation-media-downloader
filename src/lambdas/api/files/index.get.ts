/**
 * ListFiles Lambda
 *
 * Returns the list of available files for a user.
 * Supports both authenticated users and anonymous demo mode.
 *
 * Trigger: API Gateway GET /files
 * Input: Authenticated or anonymous request
 * Output: APIGatewayProxyResult with file list
 */
import {buildValidatedResponse, defineLambda, UserStatus} from '@mantleframework/core'

defineLambda({staticAssets: ['videos/default-file.mp4']})
import {logDebug} from '@mantleframework/observability'
import {metrics, MetricUnit} from '@mantleframework/observability'
import {defineApiHandler} from '@mantleframework/validation'
import {getDefaultFile} from '#config/constants'
import {getFilesForUser} from '#entities/queries'
import {fileListResponseSchema} from '#types/api-schema'
import type {File} from '#types/domainModels'
import {FileStatus} from '#types/enums'

/**
 * Transform database row to domain File type.
 * Converts null values to undefined for API response compatibility.
 */
function toFile(row: Awaited<ReturnType<typeof getFilesForUser>>[0]): File {
  return {
    fileId: row.fileId,
    size: row.size,
    authorName: row.authorName,
    authorUser: row.authorUser,
    publishDate: row.publishDate,
    description: row.description,
    key: row.key,
    contentType: row.contentType,
    title: row.title,
    status: row.status as File['status'],
    // Convert null to undefined for optional fields
    url: row.url ?? undefined,
    duration: row.duration ?? undefined,
    uploadDate: row.uploadDate ?? undefined,
    viewCount: row.viewCount ?? undefined,
    thumbnailUrl: row.thumbnailUrl ?? undefined
  }
}

/** Get files for a user using a single JOIN query */
async function getFilesByUser(userId: string): Promise<File[]> {
  logDebug('getFilesByUser <=', {userId})
  const rows = await getFilesForUser(userId)
  const files = rows.map(toFile)
  logDebug('getFilesByUser =>', {count: files.length})
  return files
}

const api = defineApiHandler({auth: 'authorizer', operationName: 'ListFiles'})
export const handler = api(async ({event, context, userId, userStatus}) => {
  if (userStatus === UserStatus.Anonymous) {
    const myResponse = {contents: [getDefaultFile()], keyCount: 1}
    return buildValidatedResponse(context, 200, myResponse, fileListResponseSchema)
  }

  // Extract status query parameter (default to 'downloaded' for backwards compatibility)
  const statusParam = event.queryStringParameters?.status || 'downloaded'
  const showAllStatuses = statusParam === 'all'

  const files = await getFilesByUser(userId as string)

  // Filter based on status parameter
  const filteredFiles = showAllStatuses ? files : files.filter((file) => file.status === FileStatus.Downloaded)

  const myResponse = {
    contents: filteredFiles.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()),
    keyCount: filteredFiles.length
  }

  // Track files returned
  metrics.addMetric('FilesReturned', MetricUnit.Count, myResponse.keyCount)

  return buildValidatedResponse(context, 200, myResponse, fileListResponseSchema)
})
