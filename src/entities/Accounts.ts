import {documentClient, Entity} from '#lib/vendor/ElectroDB/entity'

/**
 * Accounts Entity - OAuth provider connections for Better Auth.
 *
 * Links users to OAuth identity providers (Sign In With Apple, Google, etc.).
 * One user can have multiple accounts (one per provider).
 *
 * Lifecycle:
 * 1. Created when user first authenticates with a provider (RegisterUser)
 * 2. Updated when tokens are refreshed (RefreshToken Lambda)
 * 3. Deleted when user unlinks provider or deletes account (UserDelete)
 *
 * OAuth Token Management:
 * - accessToken: Short-lived token for API access (may be null after refresh)
 * - refreshToken: Long-lived token for obtaining new access tokens
 * - expiresAt: When access token expires (used for proactive refresh)
 * - idToken: OIDC ID token with user claims (used for initial auth)
 *
 * Provider Integration:
 * - Currently only Sign In With Apple is supported
 * - providerAccountId is Apple's unique user ID (stable across devices)
 * - Email may be Apple's private relay address
 *
 * Access Patterns:
 * - Primary: Get account by accountId
 * - byUser (UserCollection/GSI1): Get all OAuth providers linked to user
 * - byProvider (ProviderIndex/GSI10): Look up account by provider + providerAccountId
 *
 * @see RegisterUser Lambda for initial account creation
 * @see LoginUser Lambda for authentication via existing account
 * @see RefreshToken Lambda for token refresh
 * @see Collections.userAccounts for batch account queries
 */
export const Accounts = new Entity(
  {
    model: {entity: 'Account', version: '1', service: 'MediaDownloader'},
    attributes: {
      accountId: {type: 'string', required: true, readOnly: true},
      userId: {type: 'string', required: true},
      providerId: {type: 'string', required: true},
      providerAccountId: {type: 'string', required: true},
      accessToken: {type: 'string', required: false},
      refreshToken: {type: 'string', required: false},
      expiresAt: {type: 'number', required: false},
      scope: {type: 'string', required: false},
      tokenType: {type: 'string', required: false},
      idToken: {type: 'string', required: false},
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
      primary: {pk: {field: 'pk', composite: ['accountId']}, sk: {field: 'sk', composite: []}},
      byUser: {
        collection: 'userAccounts',
        index: 'UserCollection',
        pk: {field: 'gsi1pk', composite: ['userId']},
        sk: {field: 'gsi1sk', composite: ['providerId']}
      },
      byProvider: {index: 'ProviderIndex', pk: {field: 'gsi10pk', composite: ['providerId', 'providerAccountId']}, sk: {field: 'gsi10sk', composite: []}}
    }
  } as const,
  {table: process.env.DYNAMODB_TABLE_NAME, client: documentClient}
)

// Type exports for use in application code
export type AccountItem = ReturnType<typeof Accounts.parse>
export type CreateAccountInput = Parameters<typeof Accounts.create>[0]
export type UpdateAccountInput = Parameters<typeof Accounts.update>[0]
