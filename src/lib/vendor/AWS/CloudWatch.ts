import {PutMetricDataCommand, PutMetricDataCommandInput, PutMetricDataCommandOutput, StandardUnit} from '@aws-sdk/client-cloudwatch'
import {createCloudWatchClient} from './clients'

const cloudwatch = createCloudWatchClient()

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
  if (!unit) {
    return StandardUnit.Count
  }
  return unitMapping[unit] || StandardUnit.Count
}
