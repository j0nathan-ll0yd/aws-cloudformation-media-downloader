import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {batchGet, query} from '../../../lib/vendor/AWS/DynamoDB'
import {getBatchFilesParams, getUserFilesParams} from '../../../util/dynamodb-helpers'
import {getUserIdFromEvent, lambdaErrorResponse, logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {DynamoDBFile} from '../../../types/main'
import {defaultFile} from '../../../util/constants'

/**
 * Returns an array of Files, based on a list of File IDs
 * @param fileIds - An array of File IDs
 * @notExported
 */
async function getFilesById(fileIds: [string]) {
  const fileParams = getBatchFilesParams(process.env.DynamoDBTableFiles as string, fileIds)
  logDebug('getFilesById <=', fileParams)
  const fileResponse = await batchGet(fileParams)
  logDebug('getFilesById =>', fileResponse)
  return fileResponse
}

/**
 * Searches for a User record via their Apple Device ID
 * @param userId - The User ID
 * @notExported
 */
async function getFileIdsByUser(userId: string) {
  const userFileParams = getUserFilesParams(process.env.DynamoDBTableUserFiles as string, userId)
  logDebug('getFileIdsByUser <=', userFileParams)
  const userFilesResponse = await query(userFileParams)
  logDebug('getFileIdsByUser =>', userFilesResponse)
  return userFilesResponse
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
  let userId
  try {
    userId = getUserIdFromEvent(event as APIGatewayEvent)
  } catch (error) {
    // Unauthenticated request; return default (demo) file
    myResponse.contents = [defaultFile]
    myResponse.keyCount = myResponse.contents.length
    return response(context, 200, myResponse)
  }
  try {
    const userFilesResponse = await getFileIdsByUser(userId)
    if (Array.isArray(userFilesResponse.Items)) {
      const count = userFilesResponse.Items.length
      if (count > 0) {
        const fileResponse = await getFilesById(userFilesResponse.Items[0].fileId.values)
        if (fileResponse.Responses) {
          const table = process.env.DynamoDBTableFiles as string
          const files = fileResponse.Responses[table] as DynamoDBFile[]
          myResponse.contents = files.filter((file) => file.url !== undefined)
        }
        myResponse.keyCount = myResponse.contents.length
      }
    }
    return response(context, 200, myResponse)
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
}
