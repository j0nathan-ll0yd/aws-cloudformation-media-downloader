import {ScheduledEvent, Context, APIGatewayProxyResult} from 'aws-lambda'
import {scan} from '../../../lib/vendor/AWS/DynamoDB'
import {startExecution} from '../../../lib/vendor/AWS/StepFunctions'
import {scanForFileParams} from '../../../util/dynamodb-helpers'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'

export async function handler(event: ScheduledEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event', event)
  logInfo('context', context)
  const scanParams = scanForFileParams(process.env.DynamoDBTable)
  logDebug('scan <=', scanParams)
  const scanResponse = await scan(scanParams)
  logDebug('scan =>', scanResponse)
  for (const item of scanResponse.Items) {
    const params = {
      input: JSON.stringify({fileId: item.fileId}),
      name: new Date().getTime().toString(),
      stateMachineArn: process.env.StateMachineArn
    }
    logDebug('startExecution <=', params)
    const output = await startExecution(params)
    logDebug('startExecution =>', output)
  }
  return response(context, 200)
}
