import {CloudWatchClient, PutMetricDataCommand, PutMetricDataCommandInput, PutMetricDataCommandOutput, StandardUnit as AWSStandardUnit} from '@aws-sdk/client-cloudwatch'

const cloudwatch = new CloudWatchClient({region: process.env.AWS_REGION || 'us-west-2'})

// Re-export StandardUnit as a type-safe enum
export const StandardUnit = {
  Seconds: AWSStandardUnit.Seconds,
  Microseconds: AWSStandardUnit.Microseconds,
  Milliseconds: AWSStandardUnit.Milliseconds,
  Bytes: AWSStandardUnit.Bytes,
  Kilobytes: AWSStandardUnit.Kilobytes,
  Megabytes: AWSStandardUnit.Megabytes,
  Gigabytes: AWSStandardUnit.Gigabytes,
  Terabytes: AWSStandardUnit.Terabytes,
  Bits: AWSStandardUnit.Bits,
  Kilobits: AWSStandardUnit.Kilobits,
  Megabits: AWSStandardUnit.Megabits,
  Gigabits: AWSStandardUnit.Gigabits,
  Terabits: AWSStandardUnit.Terabits,
  Percent: AWSStandardUnit.Percent,
  Count: AWSStandardUnit.Count,
  BytesPerSecond: AWSStandardUnit.Bytes_Second,
  KilobytesPerSecond: AWSStandardUnit.Kilobytes_Second,
  MegabytesPerSecond: AWSStandardUnit.Megabytes_Second,
  GigabytesPerSecond: AWSStandardUnit.Gigabytes_Second,
  TerabytesPerSecond: AWSStandardUnit.Terabytes_Second,
  BitsPerSecond: AWSStandardUnit.Bits_Second,
  KilobitsPerSecond: AWSStandardUnit.Kilobits_Second,
  MegabitsPerSecond: AWSStandardUnit.Megabits_Second,
  GigabitsPerSecond: AWSStandardUnit.Gigabits_Second,
  TerabitsPerSecond: AWSStandardUnit.Terabits_Second,
  CountPerSecond: AWSStandardUnit.Count_Second,
  None: AWSStandardUnit.None
} as const

export type StandardUnit = typeof StandardUnit[keyof typeof StandardUnit]

export function putMetricData(params: PutMetricDataCommandInput): Promise<PutMetricDataCommandOutput> {
  const command = new PutMetricDataCommand(params)
  return cloudwatch.send(command)
}
