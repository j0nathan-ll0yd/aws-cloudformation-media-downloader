import {Entity, documentClient} from '../lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for the RateLimits DynamoDB table.
 * This entity tracks API usage for rate limiting protection.
 */
export const RateLimits = new Entity(
  {
    model: {
      entity: 'RateLimit',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      key: {
        type: 'string',
        required: true,
        readOnly: true
      },
      requests: {
        type: 'number',
        required: true,
        default: 0
      },
      windowStart: {
        type: 'number',
        required: true
      },
      ttl: {
        type: 'number',
        required: true
      }
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['key']
        },
        sk: {
          field: 'sk',
          composite: []
        }
      }
    }
  } as const,
  {
    table: process.env.DynamoDBTableName,
    client: documentClient
  }
)

export type RateLimitItem = ReturnType<typeof RateLimits.parse>
export type CreateRateLimitInput = Parameters<typeof RateLimits.create>[0]
export type UpdateRateLimitInput = Parameters<typeof RateLimits.update>[0]
