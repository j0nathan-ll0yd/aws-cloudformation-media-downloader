import {APIGatewayEvent, Context} from 'aws-lambda'
import {listObjects} from '../../../lib/vendor/AWS/S3'
import {ExtendedS3Object} from '../../../types/main'
import {ScheduledEvent} from '../../../types/vendor/Amazon/CloudWatch/ScheduledEvent'
import {processEventAndValidate} from '../../../util/apigateway-helpers'
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {objectKeysToLowerCase} from '../../../util/transformers'

export async function listFiles(event: APIGatewayEvent | ScheduledEvent, context: Context) {
  logInfo('event <=', event)
  const {statusCode, message} = processEventAndValidate(event)
  if (statusCode && message) {
    return response(context, statusCode, message)
  }
  try {
    const params = {Bucket: process.env.Bucket, MaxKeys: 1000}
    logDebug('listObjects <=', params)
    const files = await listObjects({Bucket: process.env.Bucket, MaxKeys: 1000})
    logDebug('listObjects =>', files)
    files.Contents.forEach((file: ExtendedS3Object) => {
      // https://lifegames-app-s3bucket-pq2lluyi2i12.s3.amazonaws.com/20191209-[sxephil].mp4
      file.FileUrl = `https://${files.Name}.s3.amazonaws.com/${encodeURIComponent(file.Key)}`
      return file
    })
    return response(context, 200, objectKeysToLowerCase(files))
  } catch (error) {
    throw new Error(error)
  }
}
