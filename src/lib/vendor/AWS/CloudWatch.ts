import {
  CloudWatchClient,
  PutMetricDataCommand,
  PutMetricDataCommandInput,
  PutMetricDataCommandOutput,
  StandardUnit
} from '@aws-sdk/client-cloudwatch'

const cloudwatch = new CloudWatchClient({region: process.env.AWS_REGION || 'us-west-2'})

export function putMetricData(params: PutMetricDataCommandInput): Promise<PutMetricDataCommandOutput> {
  const command = new PutMetricDataCommand(params)
  return cloudwatch.send(command)
}

export {StandardUnit}
