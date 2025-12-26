import {documentClient, Entity} from '#lib/vendor/ElectroDB/entity'

/**
 * Users Entity - Core user account management.
 *
 * Manages user accounts with Sign In With Apple integration.
 * Each user has embedded identity provider tokens for OAuth refresh.
 *
 * Lifecycle:
 * 1. Created when user signs in with Apple for the first time (RegisterUser Lambda)
 * 2. Updated when tokens are refreshed or profile changes (LoginUser, RefreshToken)
 * 3. Deleted when user requests account deletion (UserDelete Lambda)
 *
 * Identity Provider Structure:
 * The `identityProviders` map contains Apple OAuth tokens:
 * - userId: Apple's unique user identifier
 * - accessToken/refreshToken: OAuth tokens for API access
 * - email: May be Apple's private relay email
 * - isPrivateEmail: Whether user chose to hide their email
 *
 * Access Patterns:
 * - Primary: Get user by userId
 * - byEmail (EmailIndex/GSI8): Look up user by email (login flow)
 * - byAppleDeviceId (AppleDeviceIndex/GSI7): Look up user by Apple device ID (token refresh)
 *
 * @see RegisterUser Lambda for account creation
 * @see LoginUser Lambda for authentication
 * @see UserDelete Lambda for cascade deletion
 * @see Collections.userResources for querying user's files/devices
 */
export const Users = new Entity({
  model: {entity: 'User', version: '1', service: 'MediaDownloader'},
  attributes: {
    userId: {type: 'string', required: true, readOnly: true},
    email: {type: 'string', required: true},
    emailVerified: {type: 'boolean', required: true, default: false},
    firstName: {type: 'string', required: true},
    lastName: {type: 'string', required: false},
    /** Flattened Apple device ID for GSI lookup (denormalized from identityProviders.userId) */
    appleDeviceId: {type: 'string', required: false},
    identityProviders: {
      type: 'map',
      required: true,
      properties: {
        userId: {type: 'string', required: true},
        email: {type: 'string', required: true},
        emailVerified: {type: 'boolean', required: true},
        isPrivateEmail: {type: 'boolean', required: true},
        accessToken: {type: 'string', required: true},
        refreshToken: {type: 'string', required: true},
        tokenType: {type: 'string', required: true},
        expiresAt: {type: 'number', required: true}
      }
    }
  },
  indexes: {
    primary: {pk: {field: 'pk', composite: ['userId']}, sk: {field: 'sk', composite: []}},
    byEmail: {index: 'EmailIndex', pk: {field: 'gsi8pk', composite: ['email']}, sk: {field: 'gsi8sk', composite: []}},
    byAppleDeviceId: {index: 'AppleDeviceIndex', pk: {field: 'gsi7pk', composite: ['appleDeviceId']}, sk: {field: 'gsi7sk', composite: []}}
  }
} as const, {table: process.env.DYNAMODB_TABLE_NAME, client: documentClient})

// Type exports for use in application code
export type UserItem = ReturnType<typeof Users.parse>
export type CreateUserInput = Parameters<typeof Users.create>[0]
export type UpdateUserInput = Parameters<typeof Users.update>[0]
