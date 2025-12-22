import {Files} from '#entities/Files'
import {UserFiles} from '#entities/UserFiles'
import type {File} from '#types/domain-models'
import {FileStatus, UserStatus} from '#types/enums'
import {getDefaultFile} from '#config/constants'
import {buildApiResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapOptionalAuthHandler} from '#lib/lambda/middleware/api'
import {logDebug, logError} from '#lib/system/logging'
import {retryUnprocessed} from '#lib/system/retry'

/**
 * Returns an array of Files for a user using ElectroDB batch get
 * Eliminates N+1 query pattern by using batch operations
 * @param userId - The User ID
 * @notExported
 */
async function getFilesByUser(userId: string): Promise<File[]> {
  logDebug('getFilesByUser <=', userId)
  const userFilesResponse = await UserFiles.query.byUser({userId}).go()
  logDebug('getFilesByUser.userFiles =>', userFilesResponse)

  if (!userFilesResponse || !userFilesResponse.data || userFilesResponse.data.length === 0) {
    return []
  }

  const fileKeys = userFilesResponse.data.map((userFile) => ({fileId: userFile.fileId}))
  const {data: files, unprocessed} = await retryUnprocessed(() => Files.get(fileKeys).go({concurrency: 5}))
  logDebug('getFilesByUser.files =>', files)

  if (unprocessed.length > 0) {
    logError('getFilesByUser: failed to fetch all items after retries', unprocessed)
  }

  return files as File[]
}

/**
 * Returns a list of files available to the user.
 *
 * - In an authenticated state, returns the files the user has available
 * - In an anonymous state, returns a single demo file (for training purposes)
 * - Unauthenticated users (invalid token) are rejected with 401 by wrapOptionalAuthHandler
 *
 * @notExported
 */
export const handler = withPowertools(wrapOptionalAuthHandler(async ({context, userId, userStatus}) => {
  // wrapOptionalAuthHandler already rejected Unauthenticated users with 401
  const myResponse = {contents: [] as File[], keyCount: 0}

  if (userStatus === UserStatus.Anonymous) {
    myResponse.contents = [getDefaultFile()]
    myResponse.keyCount = myResponse.contents.length
    return buildApiResponse(context, 200, myResponse)
  }

  const files = await getFilesByUser(userId as string)
  myResponse.contents = files.filter((file) => file.status === FileStatus.Downloaded).sort((a, b) =>
    new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
  )
  myResponse.keyCount = myResponse.contents.length
  return buildApiResponse(context, 200, myResponse)
}))
