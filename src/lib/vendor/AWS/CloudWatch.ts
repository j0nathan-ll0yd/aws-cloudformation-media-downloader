import {CloudWatchClient, PutMetricDataCommand, PutMetricDataCommandInput, PutMetricDataCommandOutput, StandardUnit} from '@aws-sdk/client-cloudwatch'
import AWSXRay from 'aws-xray-sdk-core'

const enableXRay = process.env.ENABLE_XRAY !== 'false'
const baseClient = new CloudWatchClient({region: process.env.AWS_REGION || 'us-west-2'})
const cloudwatch = enableXRay ? AWSXRay.captureAWSv3Client(baseClient) : baseClient

// Map simple unit strings to AWS StandardUnit values (internal use only)
const unitMapping: Record<string, StandardUnit> = {
  Count: StandardUnit.Count,
  Seconds: StandardUnit.Seconds,
  Bytes: StandardUnit.Bytes,
  None: StandardUnit.None,
  Percent: StandardUnit.Percent,
  Milliseconds: StandardUnit.Milliseconds
}

export function putMetricData(params: PutMetricDataCommandInput): Promise<PutMetricDataCommandOutput> {
  const command = new PutMetricDataCommand(params)
  return cloudwatch.send(command)
}

/**
 * Get the AWS StandardUnit value for a simple unit string
 * @param unit - Simple unit string (Count, Seconds, Bytes, None, etc.)
 * @returns AWS StandardUnit value, defaults to Count if not found
 */
export function getStandardUnit(unit?: string): StandardUnit {
  if (!unit) return StandardUnit.Count
  return unitMapping[unit] || StandardUnit.Count
}
