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
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import {getFilesForUser} from '#entities/queries'
import type {File} from '#types/domainModels'
import {FileStatus, UserStatus} from '#types/enums'
import {fileListResponseSchema} from '#types/api-schema'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {getDefaultFile} from '#config/constants'
import {metrics, MetricUnit, OptionalAuthHandler} from '#lib/lambda/handlers'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {logDebug} from '#lib/system/logging'

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
  logDebug('getFilesByUser <=', userId)
  const rows = await getFilesForUser(userId)
  const files = rows.map(toFile)
  logDebug('getFilesByUser =>', files)
  return files
}

/**
 * Handler for listing files
 * Returns files for authenticated users or demo file for anonymous
 */
class ListFilesHandler extends OptionalAuthHandler {
  readonly operationName = 'ListFiles'

  protected async handleRequest(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
    this.addAnnotation('userStatus', String(this.userStatus))
    if (this.userId) {
      this.addAnnotation('userId', this.userId)
    }

    const myResponse = {contents: [] as File[], keyCount: 0}

    if (this.userStatus === UserStatus.Anonymous) {
      myResponse.contents = [getDefaultFile()]
      myResponse.keyCount = myResponse.contents.length
      this.addMetadata('fileCount', myResponse.keyCount)
      this.addMetadata('anonymous', true)
      return buildValidatedResponse(context, 200, myResponse, fileListResponseSchema)
    }

    // Extract status query parameter (default to 'downloaded' for backwards compatibility)
    const statusParam = event.queryStringParameters?.status || 'downloaded'
    const showAllStatuses = statusParam === 'all'

    const files = await getFilesByUser(this.userId as string)

    // Filter based on status parameter
    const filteredFiles = showAllStatuses ? files : files.filter((file) => file.status === FileStatus.Downloaded)

    myResponse.contents = filteredFiles.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
    myResponse.keyCount = myResponse.contents.length

    // Track files returned
    metrics.addMetric('FilesReturned', MetricUnit.Count, myResponse.keyCount)
    this.addMetadata('fileCount', myResponse.keyCount)

    return buildValidatedResponse(context, 200, myResponse, fileListResponseSchema)
  }
}

const handlerInstance = new ListFilesHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
