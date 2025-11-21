import {Entity} from 'electrodb'

/**
 * ElectroDB entity schema for the Users DynamoDB table.
 * This entity manages user accounts and identity provider information.
 */
export const Users = new Entity({
  model: {
    entity: 'User',
    version: '1',
    service: 'MediaDownloader'
  },
  attributes: {
    userId: {
      type: 'string',
      required: true,
      readOnly: true
    },
    email: {
      type: 'string',
      required: true
    },
    emailVerified: {
      type: 'boolean',
      required: true,
      default: false
    },
    firstName: {
      type: 'string',
      required: true
    },
    lastName: {
      type: 'string',
      required: false
    },
    identityProviders: {
      type: 'map',
      required: true,
      properties: {
        userId: {
          type: 'string',
          required: true
        },
        email: {
          type: 'string',
          required: true
        },
        emailVerified: {
          type: 'boolean',
          required: true
        },
        isPrivateEmail: {
          type: 'boolean',
          required: true
        },
        accessToken: {
          type: 'string',
          required: true
        },
        refreshToken: {
          type: 'string',
          required: true
        },
        tokenType: {
          type: 'string',
          required: true
        },
        expiresAt: {
          type: 'number',
          required: true
        }
      }
    }
  },
  indexes: {
    primary: {
      pk: {
        field: 'userId',
        composite: ['userId']
      }
    },
    byAppleId: {
      index: 'gsi1',
      pk: {
        field: 'gsi1pk',
        composite: [],
        template: 'APPLE#${identityProviders.userId}'
      }
    }
  }
})

// Type exports for use in application code
export type UserItem = ReturnType<typeof Users.parse>
export type CreateUserInput = Parameters<typeof Users.create>[0]
export type UpdateUserInput = Parameters<typeof Users.update>[0]