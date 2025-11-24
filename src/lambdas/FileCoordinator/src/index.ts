import {ScheduledEvent, Context, APIGatewayProxyResult} from 'aws-lambda'
import {Files} from '../../../entities/Files'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {initiateFileDownload} from '../../../util/shared'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * Returns an array of fileIds that are ready to be downloaded
 * Uses StatusIndex GSI to efficiently query PendingDownload and Scheduled files
 */
async function getFileIdsToBeDownloaded(): Promise<string[]> {
  logDebug('Querying for files ready to be downloaded')
  const now = Math.floor(Date.now() / 1000)

  const pendingResponse = await Files.query
    .byStatus({status: 'PendingDownload'})
    .where(({availableAt}, {lte}) => lte(availableAt, Date.now()))
    .where(({url}, {notExists}) => notExists(url))
    .go()
  logDebug('getPendingFiles =>', pendingResponse)

  const scheduledResponse = await Files.query
    .byStatus({status: 'Scheduled'})
    .where(({retryAfter}, {lte}) => lte(retryAfter, now))
    .go()
  logDebug('getScheduledFiles =>', scheduledResponse)

  if (!pendingResponse || !pendingResponse.data) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }

  const pendingFileIds = pendingResponse.data.map((file) => file.fileId)
  const scheduledFileIds = scheduledResponse?.data ? scheduledResponse.data.map((file) => file.fileId) : []

  return [...pendingFileIds, ...scheduledFileIds]
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
