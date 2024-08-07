import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {batchGet, query} from '../../../lib/vendor/AWS/DynamoDB'
import {getBatchFilesParams, getUserFilesParams} from '../../../util/dynamodb-helpers'
import {generateUnauthorizedError, getUserDetailsFromEvent, lambdaErrorResponse, logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {DynamoDBFile} from '../../../types/main'
import {FileStatus, UserStatus} from '../../../types/enums'
import {defaultFile} from '../../../util/constants'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'

/**
 * Returns an array of Files, based on a list of File IDs
 * @param fileIds - An array of File IDs
 * @notExported
 */
async function getFilesById(fileIds: string[]): Promise<DynamoDBFile[]> {
  const fileParams = getBatchFilesParams(process.env.DynamoDBTableFiles as string, fileIds)
  logDebug('getFilesById <=', fileParams)
  const fileResponse = await batchGet(fileParams)
  logDebug('getFilesById =>', fileResponse)
  if (!fileResponse || !fileResponse.Responses) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  const table = process.env.DynamoDBTableFiles as string
  return fileResponse.Responses[table] as unknown as DynamoDBFile[]
}

/**
 * Searches for a User record via their Apple Device ID
 * @param userId - The User ID
 * @notExported
 */
async function getFileIdsByUser(userId: string): Promise<string[]> {
  const userFileParams = getUserFilesParams(process.env.DynamoDBTableUserFiles as string, userId)
  logDebug('getFileIdsByUser <=', userFileParams)
  const userFilesResponse = await query(userFileParams)
  logDebug('getFileIdsByUser =>', userFilesResponse)
  if (!userFilesResponse || !userFilesResponse.Items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  if (userFilesResponse.Items.length === 0) {
    return []
  }
  const userFiles = userFilesResponse.Items as unknown as DynamoDBFile[]
  return userFiles.map((file) => file.fileId)
}

/**
 * Returns a list of files available to the user.
 *
 * - In an authenticated state, returns the files the user has available
 * - In an unauthenticated state, returns a single demo file (for training purposes)
 *
 * @notExported
 */
export async function handler(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  const myResponse = {contents: [] as DynamoDBFile[], keyCount: 0}
  const {userId, userStatus} = getUserDetailsFromEvent(event as APIGatewayEvent)
  // User has registered; but not logged in; will trigger login
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
}
