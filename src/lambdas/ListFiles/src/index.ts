import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {Files} from '../../../entities/Files'
import {UserFiles} from '../../../entities/UserFiles'
import {generateUnauthorizedError, getUserDetailsFromEvent, lambdaErrorResponse, logDebug, logInfo, logIncomingFixture, logOutgoingFixture, response} from '../../../util/lambda-helpers'
import {CustomAPIGatewayRequestAuthorizerEvent, DynamoDBFile} from '../../../types/main'
import {FileStatus, UserStatus} from '../../../types/enums'
import {defaultFile} from '../../../util/constants'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Returns an array of Files for a user using ElectroDB batch get
 * Eliminates N+1 query pattern by using batch operations
 * @param userId - The User ID
 * @notExported
 */
async function getFilesByUser(userId: string): Promise<DynamoDBFile[]> \{
  logDebug('getFilesByUser <=', userId)
  const userFilesResponse = await UserFiles.query.byUser(\{userId\}).go()
  logDebug('getFilesByUser.userFiles =\>', userFilesResponse)

  if (!userFilesResponse || !userFilesResponse.data || userFilesResponse.data.length === 0) \{
    return []
  \}

  const fileKeys = userFilesResponse.data.map((userFile) =\> (\{fileId: userFile.fileId\}))
  const \{data: files, unprocessed\} = await Files.get(fileKeys).go(\{concurrency: 5\})
  logDebug('getFilesByUser.files =\>', files)

  if (unprocessed.length \> 0) \{
    logDebug('getFilesByUser.unprocessed =\>', unprocessed)
  \}

  return files as DynamoDBFile[]
\}

/**
 * Returns a list of files available to the user.
 *
 * - In an authenticated state, returns the files the user has available
 * - In an unauthenticated state, returns a single demo file (for training purposes)
 *
 * @notExported
 */
export const handler = withXRay(async (event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> =\> \{
  logInfo('event <=', event)
  logIncomingFixture(event)

  const myResponse = \{contents: [] as DynamoDBFile[], keyCount: 0\}
  const \{userId, userStatus\} = getUserDetailsFromEvent(event)

  if (userStatus == UserStatus.Unauthenticated) \{
    const errorResult = lambdaErrorResponse(context, generateUnauthorizedError())
    logOutgoingFixture(errorResult)
    return errorResult
  \}

  if (userStatus == UserStatus.Anonymous) \{
    myResponse.contents = [defaultFile]
    myResponse.keyCount = myResponse.contents.length
    const result = response(context, 200, myResponse)
    logOutgoingFixture(result)
    return result
  \}

  try \{
    const files = await getFilesByUser(userId as string)
    myResponse.contents = files.filter((file) =\> file.status === FileStatus.Downloaded)
    myResponse.keyCount = myResponse.contents.length
    const result = response(context, 200, myResponse)
    logOutgoingFixture(result)
    return result
  \} catch (error) \{
    const errorResult = lambdaErrorResponse(context, error)
    logOutgoingFixture(errorResult)
    return errorResult
  \}
\})
