import {Entity, documentClient} from '../lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for the Sessions DynamoDB table.
 * This entity manages user authentication sessions with automatic expiration and device tracking.
 */
export const Sessions = new Entity(
  {
    model: {
      entity: 'Session',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      sessionId: {
        type: 'string',
        required: true,
        readOnly: true
      },
      userId: {
        type: 'string',
        required: true
      },
      refreshToken: {
        type: 'string',
        required: true
      },
      deviceId: {
        type: 'string',
        required: false
      },
      ipAddress: {
        type: 'string',
        required: false
      },
      userAgent: {
        type: 'string',
        required: false
      },
      expiresAt: {
        type: 'number',
        required: true
      },
      createdAt: {
        type: 'number',
        required: true,
        default: () => Date.now(),
        readOnly: true
      },
      lastActiveAt: {
        type: 'number',
        required: true,
        default: () => Date.now()
      }
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['sessionId']
        },
        sk: {
          field: 'sk',
          composite: []
        }
      },
      byUser: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['userId']
        },
        sk: {
          field: 'gsi1sk',
          composite: ['expiresAt']
        }
      },
      byDevice: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['deviceId']
        },
        sk: {
          field: 'gsi2sk',
          composite: ['createdAt']
        }
      }
    }
  } as const,
  {
    table: process.env.DynamoDBTableName,
    client: documentClient
  }
)

export type SessionItem = ReturnType<typeof Sessions.parse>
export type CreateSessionInput = Parameters<typeof Sessions.create>[0]
export type UpdateSessionInput = Parameters<typeof Sessions.update>[0]
