import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {Files} from '../../../entities/Files'
import {UserFiles} from '../../../entities/UserFiles'
import {sendMessage, SendMessageRequest} from '../../../lib/vendor/AWS/SQS'
import {getVideoID} from '../../../lib/vendor/YouTube'
import {CustomAPIGatewayRequestAuthorizerEvent, DynamoDBFile} from '../../../types/main'
import {Webhook} from '../../../types/vendor/IFTTT/Feedly/Webhook'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {feedlyEventSchema} from '../../../util/constraints'
import {
  getUserDetailsFromEvent,
  lambdaErrorResponse,
  logDebug,
  logIncomingFixture,
  logInfo,
  logOutgoingFixture,
  response
} from '../../../util/lambda-helpers'
import {createFileNotificationAttributes} from '../../../util/transformers'
import {FileStatus} from '../../../types/enums'
import {initiateFileDownload} from '../../../util/shared'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Associates a File to a User by creating a UserFile record
 * Creates individual record for the user-file relationship
 * Idempotent - returns gracefully if association already exists
 * @param fileId - The unique file identifier
 * @param userId - The UUID of the user
 */
export async function associateFileToUser(fileId: string, userId: string) {
  logDebug('associateFileToUser <=', {fileId, userId})
  try {
    const response = await UserFiles.create({userId, fileId}).go()
    logDebug('associateFileToUser =>', response)
    return response
  } catch (error) {
    if (error instanceof Error && error.message.includes('The conditional request failed')) {
      logDebug('associateFileToUser => already exists (idempotent)')
      return
    }
    throw error
  }
}

/**
 * Adds a base File (just fileId) to DynamoDB
 * @param fileId - The unique file identifier
 * @notExported
 */
async function addFile(fileId: string) {
  logDebug('addFile <=', fileId)
  const response = await Files.create({
    fileId,
    availableAt: Date.now(),
    size: 0,
    status: FileStatus.PendingMetadata,
    authorName: '',
    authorUser: '',
    publishDate: new Date().toISOString(),
    description: '',
    key: fileId,
    contentType: '',
    title: ''
  }).go()
  logDebug('addFile =>', response)
  return response
}

/**
 * Retrieves a File from DynamoDB (if it exists)
 * @param fileId - The unique file identifier
 * @notExported
 */
async function getFile(fileId: string): Promise<DynamoDBFile | undefined> {
  logDebug('getFile <=', fileId)
  const fileResponse = await Files.get({fileId}).go()
  logDebug('getFile =>', fileResponse)
  return fileResponse.data as DynamoDBFile | undefined
}

/**
 * Retrieves a File from DynamoDB (if it exists)
 * @param file - A DynamoDB File object
 * @param userId - The UUID of the user
 * @notExported
 */
async function sendFileNotification(file: DynamoDBFile, userId: string) {
  const messageAttributes = createFileNotificationAttributes(file, userId)
  const sendMessageParams = {
    MessageBody: 'FileNotification',
    MessageAttributes: messageAttributes,
    QueueUrl: process.env.SNSQueueUrl
  } as SendMessageRequest
  logDebug('sendMessage <=', sendMessageParams)
  const sendMessageResponse = await sendMessage(sendMessageParams)
  logDebug('sendMessage =>', sendMessageResponse)
  return sendMessageResponse
}

/**
 * Receives a webhook to download a file from Feedly.
 *
 * - If the file already exists: it is associated with the requesting user and a push notification is dispatched.
 * - If the file doesn't exist: it is associated with the requesting user and queued for download.
 *
 * @notExported
 */
export const handler = withXRay(
  async (event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> => {
    logInfo('event <=', event)
    logIncomingFixture(event)

    let requestBody
    try {
      requestBody = getPayloadFromEvent(event) as Webhook
      validateRequest(requestBody, feedlyEventSchema)
      const fileId = getVideoID(requestBody.articleURL)
      const {userId} = getUserDetailsFromEvent(event)
      if (!userId) {
        throw new UnexpectedError(providerFailureErrorMessage)
      }
      await associateFileToUser(fileId, userId)
      const file = await getFile(fileId)
      let result: APIGatewayProxyResult
      if (file && file.status == FileStatus.Downloaded) {
        await sendFileNotification(file, userId)
        result = response(context, 200, {status: 'Dispatched'})
      } else {
        if (!file) {
          await addFile(fileId)
        }
        if (!requestBody.backgroundMode) {
          await initiateFileDownload(fileId)
          result = response(context, 202, {status: 'Initiated'})
        } else {
          result = response(context, 202, {status: 'Accepted'})
        }
      }
      logOutgoingFixture(result)
      return result
    } catch (error) {
      const errorResult = lambdaErrorResponse(context, error)
      logOutgoingFixture(errorResult)
      return errorResult
    }
  }
)
