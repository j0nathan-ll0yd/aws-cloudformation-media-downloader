import {ScheduledEvent, Context, APIGatewayProxyResult} from 'aws-lambda'
import {scan} from '../../../lib/vendor/AWS/DynamoDB'
import {scanForFileParams} from '../../../util/dynamodb-helpers'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {initiateFileDownload} from '../../../util/shared'
import {withXRay} from '../../../util/lambdaDecorator'

/**
 * Returns an array of filesIds that are ready to be downloaded
 */
async function getFileIdsToBeDownloaded(): Promise<string[]> {
  const scanParams = scanForFileParams(process.env.DynamoDBTableFiles as string)
  logDebug('getFilesToBeDownloaded <=', scanParams)
  const scanResponse = await scan(scanParams)
  logDebug('getFilesToBeDownloaded =>', scanResponse)
  if (!scanResponse || !scanResponse.Items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return scanResponse.Items.map((file) => file.fileId.toString())
}

/**
 * A scheduled event lambdas that checks for files to be downloaded
 * @param event - An AWS ScheduledEvent; happening every X minutes
 * @param context - An AWS Context object
 */
export const handler = withXRay(async (event: ScheduledEvent, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('event', event)
  const files = await getFileIdsToBeDownloaded()
  const downloads: Promise<void>[] = []
  files.forEach((fileId) => downloads.push(initiateFileDownload(fileId)))
  await Promise.all(downloads)
  return response(context, 200)
})
