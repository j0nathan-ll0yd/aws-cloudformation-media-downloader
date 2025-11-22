import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {Files} from '../../../lib/vendor/ElectroDB/entities/Files'
import {UserFiles} from '../../../lib/vendor/ElectroDB/entities/UserFiles'
import {generateUnauthorizedError, getUserDetailsFromEvent, lambdaErrorResponse, logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {CustomAPIGatewayRequestAuthorizerEvent, DynamoDBFile} from '../../../types/main'
import {FileStatus, UserStatus} from '../../../types/enums'
import {defaultFile} from '../../../util/constants'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Returns an array of Files, based on a list of File IDs
 * @param fileIds - An array of File IDs
 * @notExported
 */
async function getFilesById(fileIds: string[]): Promise<DynamoDBFile[]> {
  logDebug('getFilesById <=', fileIds)
  const filePromises = fileIds.map((fileId) => Files.get({fileId}).go())
  const fileResponses = await Promise.all(filePromises)
  logDebug('getFilesById =>', fileResponses)
  const files = fileResponses.filter((response) => response.data).map((response) => response.data as DynamoDBFile)
  if (files.length === 0) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return files
}

/**
 * Gets file IDs associated with a user
 * @param userId - The User ID
 * @notExported
 */
async function getFileIdsByUser(userId: string): Promise<string[]> {
  logDebug('getFileIdsByUser <=', userId)
  const userFilesResponse = await UserFiles.get({userId}).go()
  logDebug('getFileIdsByUser =>', userFilesResponse)
  if (!userFilesResponse || !userFilesResponse.data) {
    return []
  }
  return userFilesResponse.data.fileId || []
}

/**
 * Returns a list of files available to the user.
 *
 * - In an authenticated state, returns the files the user has available
 * - In an unauthenticated state, returns a single demo file (for training purposes)
 *
 * @notExported
 */
export const handler = withXRay(async (event: CustomAPIGatewayRequestAuthorizerEvent, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('event <=', event)
  const myResponse = {contents: [] as DynamoDBFile[], keyCount: 0}
  const {userId, userStatus} = getUserDetailsFromEvent(event)
  if (userStatus == UserStatus.Unauthenticated) {
    return lambdaErrorResponse(context, generateUnauthorizedError())
  }
  if (userStatus == UserStatus.Anonymous) {
    myResponse.contents = [defaultFile]
    myResponse.keyCount = myResponse.contents.length
    return response(context, 200, myResponse)
  }
  try {
    const fileIds = await getFileIdsByUser(userId as string)
    if (fileIds.length > 0) {
      const files = await getFilesById(fileIds)
      myResponse.contents = files.filter((file) => file.status === FileStatus.Downloaded)
    }
    myResponse.keyCount = myResponse.contents.length
    return response(context, 200, myResponse)
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
})
