import {ScheduledEvent, Context, APIGatewayProxyResult} from 'aws-lambda'
import {scan} from '../../../lib/vendor/AWS/DynamoDB'
import {startExecution} from '../../../lib/vendor/AWS/StepFunctions'
import {scanForFileParams} from '../../../util/dynamodb-helpers'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {Types} from 'aws-sdk/clients/stepfunctions'
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
  for (const fileId of files) {
    const params = {
      input: JSON.stringify({fileId}),
      name: new Date().getTime().toString(),
      stateMachineArn: process.env.StateMachineArn
    } as Types.StartExecutionInput
    logDebug('startExecution <=', params)
    const output = await startExecution(params)
    logDebug('startExecution =>', output)
  }
  return response(context, 200)
}
