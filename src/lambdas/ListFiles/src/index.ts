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
import {getFilesForUser} from '#entities/queries'
import type {File} from '#types/domainModels'
import {FileStatus, UserStatus} from '#types/enums'
import {fileListResponseSchema} from '#types/api-schema'
import {getDefaultFile} from '#config/constants'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapOptionalAuthHandler} from '#lib/lambda/middleware/api'
import {logDebug} from '#lib/system/logging'

// Get files for a user using a single JOIN query (replaces N+1 batch pattern)
async function getFilesByUser(userId: string): Promise<File[]> {
  logDebug('getFilesByUser <=', userId)
  const files = await getFilesForUser(userId)
  logDebug('getFilesByUser =>', files)
  return files as File[]
}

/**
 * Returns a list of files available to the user.
 *
 * - In an authenticated state, returns the files the user has available
 * - In an anonymous state, returns a single demo file (for training purposes)
 * - Unauthenticated users (invalid token) are rejected with 401 by wrapOptionalAuthHandler
 *
 * Query parameters:
 * - status=all: Returns files in all statuses (Queued, Downloading, Downloaded, Failed)
 * - status=downloaded (default): Returns only downloaded files
 *
 * @notExported
 */
export const handler = withPowertools(wrapOptionalAuthHandler(async ({event, context, userId, userStatus}) => {
  // wrapOptionalAuthHandler already rejected Unauthenticated users with 401
  const myResponse = {contents: [] as File[], keyCount: 0}

  if (userStatus === UserStatus.Anonymous) {
    myResponse.contents = [getDefaultFile()]
    myResponse.keyCount = myResponse.contents.length
    return buildValidatedResponse(context, 200, myResponse, fileListResponseSchema)
  }

  // Extract status query parameter (default to 'downloaded' for backwards compatibility)
  const statusParam = event.queryStringParameters?.status || 'downloaded'
  const showAllStatuses = statusParam === 'all'

  const files = await getFilesByUser(userId as string)

  // Filter based on status parameter
  const filteredFiles = showAllStatuses
    ? files
    : files.filter((file) => file.status === FileStatus.Downloaded)

  myResponse.contents = filteredFiles.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
  myResponse.keyCount = myResponse.contents.length
  return buildValidatedResponse(context, 200, myResponse, fileListResponseSchema)
}))
