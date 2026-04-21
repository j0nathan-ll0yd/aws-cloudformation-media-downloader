/**
 * WebhookFeedly Lambda
 *
 * Receives Feedly webhook notifications for new YouTube videos.
 * Validates the article URL, creates a file record, and queues for download.
 *
 * Trigger: API Gateway POST /feedly/webhook
 * Input: FeedlyWebhookRequest with articleURL
 * Output: APIGatewayProxyResult with file metadata
 *
 * @see {@link ../../../services/file/webhookProcessingService.ts} for processing logic
 */
import {buildValidatedResponse} from '@mantleframework/core'
import {logInfo, metrics, MetricUnit} from '@mantleframework/observability'
import {defineApiHandler, z} from '@mantleframework/validation'
import {getIdempotentProcessor} from '#services/file/webhookProcessingService'
import {getVideoID} from '#services/youtube/youtube'
import {webhookResponseSchema} from '#types/api-schema'

const FeedlyWebhookRequestSchema = z.object({articleURL: z.string()})

const api = defineApiHandler({auth: 'authorizer', schema: FeedlyWebhookRequestSchema, operationName: 'WebhookFeedly'})
export const handler = api(async ({context, userId, body, metadata}) => {
  metrics.addMetric('WebhookReceived', MetricUnit.Count, 1)
  logInfo('Processing request', {correlationId: metadata.correlationId, traceId: metadata.traceId})

  const fileId = getVideoID(body.articleURL)
  const {processor, config} = getIdempotentProcessor()
  config.registerLambdaContext(context)

  const result = await processor({fileId, userId, articleURL: body.articleURL, correlationId: metadata.correlationId})
  metrics.addMetric('WebhookProcessed', MetricUnit.Count, 1)

  return buildValidatedResponse(context, result.statusCode, {status: result.status as 'Dispatched' | 'Initiated' | 'Accepted'}, webhookResponseSchema)
})
