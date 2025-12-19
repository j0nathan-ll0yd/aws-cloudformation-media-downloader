import type {CloudFrontResponse, CloudFrontResultResponse} from 'aws-lambda'
import type {CloudFrontCustomOrigin, CloudFrontRequest} from 'aws-lambda/common/cloudfront'

export type CloudFrontHandlerResult = CloudFrontRequest | CloudFrontResultResponse | CloudFrontResponse

export type CustomCloudFrontOrigin = {custom: CloudFrontCustomOrigin}

export interface CustomCloudFrontRequest extends CloudFrontRequest {
  clientIp: string
  origin: CustomCloudFrontOrigin
}
