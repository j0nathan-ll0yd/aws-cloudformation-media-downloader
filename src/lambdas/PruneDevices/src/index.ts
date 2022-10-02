import {ScheduledEvent, Context, APIGatewayProxyResult} from 'aws-lambda'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {scan} from '../../../lib/vendor/AWS/DynamoDB'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {Device} from '../../../types/main'

/**
 * Returns a array of filesIds that are ready to be downloaded
 * @notExported
 */
async function getDevices(): Promise<Device[]> {
  logDebug('getDevies <=')
  const scanResponse = await scan({TableName: process.env.DynamoDBTableDevices})
  logDebug('getDevies =>', scanResponse)
  if (!scanResponse || !scanResponse.Items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return scanResponse.Items as Device[]
}

/*
async function dispatchHealthCheck(endpointArn: string): Promise<void> {
  const params = generateHealthCheckNotification(endpointArn)
  logDebug('dispatchHealthCheck <=', params)
  const response = await publishSnsEvent(params)
  logDebug('dispatchHealthCheck <=', response)
}
*/

export async function handler(event: ScheduledEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event', event)
  const devices = await getDevices()
  devices.forEach((device) => logDebug('device', device))
  return response(context, 200)
}
