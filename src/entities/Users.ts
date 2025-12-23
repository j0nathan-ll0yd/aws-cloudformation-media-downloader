import {documentClient, Entity} from '#lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for the Users DynamoDB table.
 * This entity manages user accounts and identity provider information.
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
    byEmail: {index: 'gsi3', pk: {field: 'gsi3pk', composite: ['email']}, sk: {field: 'gsi3sk', composite: []}},
    byAppleDeviceId: {index: 'gsi7', pk: {field: 'gsi7pk', composite: ['appleDeviceId']}, sk: {field: 'gsi7sk', composite: []}}
  }
} as const, {table: process.env.DYNAMODB_TABLE_NAME, client: documentClient})

// Type exports for use in application code
export type UserItem = ReturnType<typeof Users.parse>
export type CreateUserInput = Parameters<typeof Users.create>[0]
export type UpdateUserInput = Parameters<typeof Users.update>[0]
