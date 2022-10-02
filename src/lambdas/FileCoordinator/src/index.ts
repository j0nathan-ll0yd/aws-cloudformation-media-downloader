import {ScheduledEvent, Context, APIGatewayProxyResult} from 'aws-lambda'
import {scan} from '../../../lib/vendor/AWS/DynamoDB'
import {scanForFileParams} from '../../../util/dynamodb-helpers'
import {logDebug, logInfo, response, initiateFileDownload} from '../../../util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'

/**
 * Returns a array of filesIds that are ready to be downloaded
 * @notExported
 */
async function getFileIdsToBeDownloaded(): Promise<string[]> {
  const scanParams = scanForFileParams(process.env.DynamoDBTableFiles as string)
  logDebug('getFilesToBeDownloaded <=', scanParams)
  const scanResponse = await scan(scanParams)
  logDebug('getFilesToBeDownloaded =>', scanResponse)
  if (!scanResponse || !scanResponse.Items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return scanResponse.Items.map((file) => file.fileId)
}



export async function handler(event: ScheduledEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event', event)
  const files = await getFileIdsToBeDownloaded()
  const downloads: Promise<void>[] = []
  files.forEach((fileId) => downloads.push(initiateFileDownload(fileId)))
  await Promise.all(downloads)
  return response(context, 200)
}
