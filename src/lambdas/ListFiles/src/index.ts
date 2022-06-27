import {APIGatewayEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {batchGet, query} from '../../../lib/vendor/AWS/DynamoDB'
import {getBatchFilesParams, getUserFilesParams} from '../../../util/dynamodb-helpers'
import {getUserIdFromEvent, logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {defaultFile} from '../../../util/constants'

/**
 * Returns an array of Files, based on a list of File IDs
 * @param fileIds - An array of File IDs
 * @notExported
 */
async function getFilesById(fileIds: [string]) {
  const fileParams = getBatchFilesParams(process.env.DynamoTableFiles, fileIds)
  logDebug('query <=', fileParams)
  const fileResponse = await batchGet(fileParams)
  logDebug('query =>', fileResponse)
  return fileResponse
}

/**
 * Searches for a User record via their Apple Device ID
 * @param userId - The User ID
 * @notExported
 */
async function getFileIdsByUser(userId: string) {
  const userFileParams = getUserFilesParams(process.env.DynamoTableUserFiles, userId)
  logDebug('query <=', userFileParams)
  const userFilesResponse = await query(userFileParams)
  logDebug('query =>', userFilesResponse)
  return userFilesResponse
}

export async function handler(event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  const myResponse = {contents: [], keyCount: 0}
  let userId
  try {
    userId = getUserIdFromEvent(event as APIGatewayEvent)
  } catch (error) {
    logInfo('error <=', error)
    // Unauthenticated request; return default (demo) file
    myResponse.contents = [defaultFile]
    myResponse.keyCount = myResponse.contents.length
    return response(context, 200, myResponse)
  }
  try {
    const userFilesResponse = await getFileIdsByUser(userId)
    if (userFilesResponse.Count > 0) {
      const fileResponse = await getFilesById(userFilesResponse.Items[0].fileId.values)
      myResponse.contents = fileResponse.Responses[process.env.DynamoTableFiles].filter((file) => file.url)
      myResponse.keyCount = myResponse.contents.length
    }
    return response(context, 200, myResponse)
  } catch (error) {
    throw new Error(error)
  }
}
