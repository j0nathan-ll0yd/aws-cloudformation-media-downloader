import {ScheduledEvent, Context, APIGatewayProxyResult} from 'aws-lambda'
import {Files} from '../../../entities/Files'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {initiateFileDownload} from '../../../util/shared'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Returns an array of fileIds that are ready to be downloaded
 * Uses StatusIndex GSI to efficiently query PendingDownload files
 */
async function getFileIdsToBeDownloaded(): Promise<string[]> {
  logDebug('Querying for files ready to be downloaded')
  const queryResponse = await Files.query
    .byStatus({status: 'PendingDownload'})
    .where(({availableAt}, {lte}) => lte(availableAt, Date.now()))
    .where(({url}, {notExists}) => notExists(url))
    .go()
  logDebug('getFilesToBeDownloaded =>', queryResponse)
  if (!queryResponse || !queryResponse.data) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return queryResponse.data.map((file) => file.fileId)
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
