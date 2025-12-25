import {documentClient, Entity} from '#lib/vendor/ElectroDB/entity'

/**
 * Sessions Entity - Better Auth user session management.
 *
 * Manages authentication sessions with automatic expiration.
 * Used by Better Auth for session-based authentication.
 *
 * Lifecycle:
 * 1. Created when user logs in successfully (LoginUser Lambda)
 * 2. Updated when session is refreshed (activity extends expiration)
 * 3. Expires automatically when expiresAt timestamp is reached
 * 4. Deleted when user logs out or session is invalidated
 *
 * Session Token Flow:
 * - User authenticates with Sign In With Apple
 * - Better Auth creates session with hashed token
 * - Token returned to client as HTTP-only cookie
 * - Subsequent requests validate token via byToken index
 *
 * Security Features:
 * - ipAddress: Tracks originating IP for anomaly detection
 * - userAgent: Identifies client device/browser
 * - updatedAt: Auto-updates on any change for activity tracking
 *
 * Access Patterns:
 * - Primary: Get session by sessionId
 * - byUser (GSI1): Get all sessions for a user (logout-all, session list)
 * - byToken (GSI2): Validate session token (request authentication)
 *
 * @see LoginUser Lambda for session creation
 * @see ApiGatewayAuthorizer for session validation
 * @see Collections.userSessions for batch session queries
 */
export const Sessions = new Entity(
  {
    model: {entity: 'Session', version: '1', service: 'MediaDownloader'},
    attributes: {
      sessionId: {type: 'string', required: true, readOnly: true},
      userId: {type: 'string', required: true},
      expiresAt: {type: 'number', required: true},
      token: {type: 'string', required: true},
      ipAddress: {type: 'string', required: false},
      userAgent: {type: 'string', required: false},
      deviceId: {type: 'string', required: false},
      createdAt: {type: 'number', required: true, default: () => Date.now(), readOnly: true},
      updatedAt: {
        type: 'number',
        required: true,
        default: () => Date.now(),
        watch: '*',
        set: () => Date.now()
      }
    },
    indexes: {
      primary: {pk: {field: 'pk', composite: ['sessionId']}, sk: {field: 'sk', composite: []}},
      byUser: {collection: 'userSessions', index: 'gsi1', pk: {field: 'gsi1pk', composite: ['userId']}, sk: {field: 'gsi1sk', composite: ['expiresAt']}},
      byToken: {index: 'gsi2', pk: {field: 'gsi2pk', composite: ['token']}, sk: {field: 'gsi2sk', composite: []}}
    }
  } as const,
  {table: process.env.DYNAMODB_TABLE_NAME, client: documentClient}
)

// Type exports for use in application code
export type SessionItem = ReturnType<typeof Sessions.parse>
export type CreateSessionInput = Parameters<typeof Sessions.create>[0]
export type UpdateSessionInput = Parameters<typeof Sessions.update>[0]
