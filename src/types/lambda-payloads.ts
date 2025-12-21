import type {CloudFrontResponse, CloudFrontResultResponse} from 'aws-lambda'
import type {CloudFrontCustomOrigin, CloudFrontRequest} from 'aws-lambda/common/cloudfront'

/**
 * Result of the PruneDevices operation
 */
export interface PruneDevicesResult {
  devicesChecked: number
  devicesPruned: number
  errors: string[]
}

export interface ApplePushNotificationResponse {
  statusCode: number
  reason?: string
}

export type CloudFrontHandlerResult = CloudFrontRequest | CloudFrontResultResponse | CloudFrontResponse

export type CustomCloudFrontOrigin = {custom: CloudFrontCustomOrigin}

export interface CustomCloudFrontRequest extends CloudFrontRequest {
  clientIp: string
  origin: CustomCloudFrontOrigin
}
