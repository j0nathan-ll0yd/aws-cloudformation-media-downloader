import {ScheduledEvent, Context, APIGatewayProxyResult} from 'aws-lambda'
import {Files} from '../../../lib/vendor/ElectroDB/entities/Files'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {initiateFileDownload} from '../../../util/shared'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Returns an array of filesIds that are ready to be downloaded
 */
async function getFileIdsToBeDownloaded(): Promise<string[]> {
  logDebug('Scanning for files ready to be downloaded')
  const scanResponse = await Files.scan
    .where(({availableAt}, {lte}) => lte(availableAt, Date.now()))
    .where(({url}, {notExists}) => notExists(url))
    .go()
  logDebug('getFilesToBeDownloaded =>', scanResponse)
  if (!scanResponse || !scanResponse.data) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return scanResponse.data.map((file) => file.fileId)
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
