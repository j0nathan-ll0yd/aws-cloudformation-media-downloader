import {
  documentClient,
  Entity
} from '../lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for Better Auth verification tokens.
 * Manages email verification tokens and magic link tokens with automatic expiration.
 *
 * Better Auth Verification Token Schema:
 * - identifier: email address or user identifier
 * - token: verification token (hashed)
 * - expiresAt: token expiration timestamp
 * - createdAt: token creation timestamp
 *
 * Note: Verification tokens are single-use and should be deleted after verification.
 * DynamoDB TTL is configured on the ttl attribute to automatically clean up expired tokens.
 */
export const VerificationTokens = new Entity(
  {
    model: { entity: 'VerificationToken', version: '1', service: 'MediaDownloader' },
    attributes: {
      identifier: { type: 'string', required: true },
      token: { type: 'string', required: true, readOnly: true },
      expiresAt: { type: 'number', required: true },
      ttl: {
        type: 'number',
        required: true,
        default: () => Math.floor(Date.now() / 1000) + 86400 // 24 hours from now
      },
      createdAt: { type: 'number', required: true, default: () => Date.now(), readOnly: true }
    },
    indexes: {
      primary: { pk: { field: 'pk', composite: ['token'] }, sk: { field: 'sk', composite: [] } },
      byIdentifier: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['identifier'] },
        sk: { field: 'gsi1sk', composite: ['expiresAt'] }
      }
    }
  } as const,
  { table: process.env.DynamoDBTableName, client: documentClient }
)

// Type exports for use in application code
export type VerificationTokenItem = ReturnType<typeof VerificationTokens.parse>
export type CreateVerificationTokenInput = Parameters<typeof VerificationTokens.create>[0]
