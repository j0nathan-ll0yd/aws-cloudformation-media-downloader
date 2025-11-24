import {Entity, documentClient} from '../lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for the Accounts DynamoDB table.
 * This entity links users to OAuth providers (Apple, Google, GitHub) and email/password authentication.
 */
export const Accounts = new Entity(
  {
    model: {
      entity: 'Account',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      accountId: {
        type: 'string',
        required: true,
        readOnly: true
      },
      userId: {
        type: 'string',
        required: true
      },
      provider: {
        type: 'string',
        required: true
      },
      providerAccountId: {
        type: 'string',
        required: true
      },
      accessToken: {
        type: 'string',
        required: false
      },
      refreshToken: {
        type: 'string',
        required: false
      },
      tokenExpiresAt: {
        type: 'number',
        required: false
      },
      scope: {
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
        default: () => Date.now()
      }
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['accountId']
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
          composite: ['provider']
        }
      },
      byProvider: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['provider', 'providerAccountId']
        },
        sk: {
          field: 'gsi2sk',
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

export type AccountItem = ReturnType<typeof Accounts.parse>
export type CreateAccountInput = Parameters<typeof Accounts.create>[0]
export type UpdateAccountInput = Parameters<typeof Accounts.update>[0]
