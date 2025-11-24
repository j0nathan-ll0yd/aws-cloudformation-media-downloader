import {Entity, documentClient} from '../lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for the VerificationTokens DynamoDB table.
 * This entity manages tokens for email verification, password reset, and magic links.
 */
export const VerificationTokens = new Entity(
  {
    model: {
      entity: 'VerificationToken',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      token: {
        type: 'string',
        required: true,
        readOnly: true
      },
      identifier: {
        type: 'string',
        required: true
      },
      type: {
        type: 'string',
        required: true
      },
      expiresAt: {
        type: 'number',
        required: true
      },
      used: {
        type: 'boolean',
        required: true,
        default: false
      },
      createdAt: {
        type: 'number',
        required: true,
        default: () => Date.now(),
        readOnly: true
      }
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['token']
        },
        sk: {
          field: 'sk',
          composite: []
        }
      },
      byIdentifier: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['identifier']
        },
        sk: {
          field: 'gsi1sk',
          composite: ['type', 'expiresAt']
        }
      }
    }
  } as const,
  {
    table: process.env.DynamoDBTableName,
    client: documentClient
  }
)

export type VerificationTokenItem = ReturnType<typeof VerificationTokens.parse>
export type CreateVerificationTokenInput = Parameters<typeof VerificationTokens.create>[0]
