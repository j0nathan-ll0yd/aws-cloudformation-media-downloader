import {
  documentClient,
  Entity
} from '../lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for Better Auth accounts (OAuth provider links).
 * Manages OAuth provider connections for users (Apple, Google, GitHub, etc.).
 *
 * Better Auth Account Schema:
 * - id: unique account identifier
 * - userId: reference to user who owns this account
 * - providerId: OAuth provider name ('apple', 'google', 'github', etc.)
 * - providerAccountId: user ID from the provider (e.g., Apple User ID)
 * - accessToken: OAuth access token from provider
 * - refreshToken: OAuth refresh token from provider
 * - expiresAt: token expiration timestamp
 * - scope: OAuth scopes granted
 * - tokenType: OAuth token type (usually 'Bearer')
 * - idToken: OIDC ID token if available
 */
export const Accounts = new Entity(
  {
    model: { entity: 'Account', version: '1', service: 'MediaDownloader' },
    attributes: {
      accountId: { type: 'string', required: true, readOnly: true },
      userId: { type: 'string', required: true },
      providerId: { type: 'string', required: true },
      providerAccountId: { type: 'string', required: true },
      accessToken: { type: 'string', required: false },
      refreshToken: { type: 'string', required: false },
      expiresAt: { type: 'number', required: false },
      scope: { type: 'string', required: false },
      tokenType: { type: 'string', required: false },
      idToken: { type: 'string', required: false },
      createdAt: { type: 'number', required: true, default: () => Date.now(), readOnly: true },
      updatedAt: {
        type: 'number',
        required: true,
        default: () => Date.now(),
        watch: '*',
        set: () => Date.now()
      }
    },
    indexes: {
      primary: { pk: { field: 'pk', composite: ['accountId'] }, sk: { field: 'sk', composite: [] } },
      byUser: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['userId'] },
        sk: { field: 'gsi1sk', composite: ['providerId'] }
      },
      byProvider: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['providerId', 'providerAccountId'] },
        sk: { field: 'gsi2sk', composite: [] }
      }
    }
  } as const,
  { table: process.env.DynamoDBTableName, client: documentClient }
)

// Type exports for use in application code
export type AccountItem = ReturnType<typeof Accounts.parse>
export type CreateAccountInput = Parameters<typeof Accounts.create>[0]
export type UpdateAccountInput = Parameters<typeof Accounts.update>[0]
