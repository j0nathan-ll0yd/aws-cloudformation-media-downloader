/**
 * AWS Lambda Powertools Parser integration with Zod
 * Provides middleware-based payload validation for Lambda handlers
 * @see https://docs.aws.amazon.com/powertools/typescript/latest/utilities/parser/
 */
import {parser} from '@aws-lambda-powertools/parser/middleware'
import {ApiGatewayEnvelope, ApiGatewayV2Envelope} from '@aws-lambda-powertools/parser/envelopes'
import type {ZodSchema} from 'zod'

/**
 * Create a Powertools parser middleware for API Gateway events with Zod schema
 * Automatically extracts and validates the request body against the provided schema
 *
 * @param schema - Zod schema to validate request body
 * @returns Middy middleware that parses and validates the request body
 *
 * @example
 * ```typescript
 * import middy from '@middy/core'
 * import {feedlyEventSchema} from '#util/constraints'
 * import {createApiBodyParser} from '#lib/vendor/Powertools/parser'
 *
 * const handler = middy(async (event) => {
 *   // event.body is now typed and validated as FeedlyEventInput
 *   const {articleURL, backgroundMode} = event.body
 *   // ...
 * }).use(createApiBodyParser(feedlyEventSchema))
 * ```
 */
export function createApiBodyParser<T>(schema: ZodSchema<T>) {
  return parser({schema, envelope: ApiGatewayEnvelope})
}

/**
 * Create a parser middleware for API Gateway V2 (HTTP API) events
 */
export function createApiV2BodyParser<T>(schema: ZodSchema<T>) {
  return parser({schema, envelope: ApiGatewayV2Envelope})
}

// Re-export parser utilities
export { ApiGatewayEnvelope, ApiGatewayV2Envelope, parser }
