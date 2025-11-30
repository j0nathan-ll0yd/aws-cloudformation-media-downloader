import {Entity, documentClient} from '../lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for Better Auth sessions.
 * Manages user authentication sessions with automatic expiration and device tracking.
 *
 * Better Auth Session Schema:
 * - id: unique session identifier
 * - userId: reference to user
 * - expiresAt: session expiration timestamp
 * - token: session token (hashed)
 * - ipAddress: client IP for security
 * - userAgent: client user agent for device tracking
 * - createdAt: session creation timestamp
 * - updatedAt: last activity timestamp
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
      expiresAt: {
        type: 'number',
        required: true
      },
      token: {
        type: 'string',
        required: true
      },
      ipAddress: {
        type: 'string',
        required: false
      },
      userAgent: {
        type: 'string',
        required: false
      },
      deviceId: {
        type: 'string',
        required: false
      },
      createdAt: {
        type: 'number',
        required: true,
        default: () => Date.now(),
        readOnly: true
      },
      updatedAt: {
        type: 'number',
        required: true,
        default: () => Date.now(),
        watch: '*',
        set: () => Date.now()
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
        collection: 'userSessions',
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

// Type exports for use in application code
export type SessionItem = ReturnType<typeof Sessions.parse>
export type CreateSessionInput = Parameters<typeof Sessions.create>[0]
export type UpdateSessionInput = Parameters<typeof Sessions.update>[0]
