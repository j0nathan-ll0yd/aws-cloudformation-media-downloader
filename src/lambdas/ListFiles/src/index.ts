import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {Files} from '../../../entities/Files'
import {UserFiles} from '../../../entities/UserFiles'
import {generateUnauthorizedError, getUserDetailsFromEvent, lambdaErrorResponse, logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {CustomAPIGatewayRequestAuthorizerEvent, DynamoDBFile} from '../../../types/main'
import {FileStatus, UserStatus} from '../../../types/enums'
import {defaultFile} from '../../../util/constants'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Returns an array of Files for a user using UserCollection GSI
 * Eliminates N+1 query pattern by querying user's files in one operation
 * @param userId - The User ID
 * @notExported
 */
async function getFilesByUser(userId: string): Promise<DynamoDBFile[]> {
  logDebug('getFilesByUser <=', userId)
  const userFilesResponse = await UserFiles.query.byUser({userId}).go()
  logDebug('getFilesByUser.userFiles =>', userFilesResponse)

  if (!userFilesResponse || !userFilesResponse.data || userFilesResponse.data.length === 0) {
    return []
  }

  const fileIds = userFilesResponse.data.map((userFile) => userFile.fileId)
  const filePromises = fileIds.map((fileId) => Files.get({fileId}).go())
  const fileResponses = await Promise.all(filePromises)
  logDebug('getFilesByUser.files =>', fileResponses)

  const files = fileResponses.filter((response) => response.data).map((response) => response.data as DynamoDBFile)
  return files
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
    const files = await getFilesByUser(userId as string)
    myResponse.contents = files.filter((file) => file.status === FileStatus.Downloaded)
    myResponse.keyCount = myResponse.contents.length
    return response(context, 200, myResponse)
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
})
