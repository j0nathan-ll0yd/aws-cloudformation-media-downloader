import {
  CreateTableCommand,
  DynamoDBClient
} from '@aws-sdk/client-dynamodb'

/**
 * Setup MediaDownloader DynamoDB table in LocalStack
 * Creates table with all required GSIs for ElectroDB entities
 *
 * Table Design (lowercase to match ElectroDB entity field names):
 * - Primary Key: pk (HASH), sk (RANGE)
 * - gsi1: gsi1pk (HASH), gsi1sk (RANGE) - UserCollection (userResources)
 * - gsi2: gsi2pk (HASH), gsi2sk (RANGE) - FileCollection (fileUsers)
 * - gsi3: gsi3pk (HASH), gsi3sk (RANGE) - DeviceCollection (deviceUsers)
 *
 * @returns Promise that resolves when table is created
 */
export async function setupLocalStackTable(): Promise<void> {
  const client = new DynamoDBClient({
    endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
  })

  const tableName = process.env.DynamoDBTableName || 'MediaDownloader'

  try {
    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
          { AttributeName: 'gsi1pk', AttributeType: 'S' },
          { AttributeName: 'gsi1sk', AttributeType: 'S' },
          { AttributeName: 'gsi2pk', AttributeType: 'S' },
          { AttributeName: 'gsi2sk', AttributeType: 'S' },
          { AttributeName: 'gsi3pk', AttributeType: 'S' },
          { AttributeName: 'gsi3sk', AttributeType: 'S' }
        ],
        KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }, {
          AttributeName: 'sk',
          KeyType: 'RANGE'
        }],
        GlobalSecondaryIndexes: [{
          IndexName: 'gsi1',
          KeySchema: [{ AttributeName: 'gsi1pk', KeyType: 'HASH' }, {
            AttributeName: 'gsi1sk',
            KeyType: 'RANGE'
          }],
          Projection: { ProjectionType: 'ALL' }
        }, {
          IndexName: 'gsi2',
          KeySchema: [{ AttributeName: 'gsi2pk', KeyType: 'HASH' }, {
            AttributeName: 'gsi2sk',
            KeyType: 'RANGE'
          }],
          Projection: { ProjectionType: 'ALL' }
        }, {
          IndexName: 'gsi3',
          KeySchema: [{ AttributeName: 'gsi3pk', KeyType: 'HASH' }, {
            AttributeName: 'gsi3sk',
            KeyType: 'RANGE'
          }],
          Projection: { ProjectionType: 'ALL' }
        }],
        BillingMode: 'PAY_PER_REQUEST'
      })
    )

    console.log(`✅ Created table: ${tableName}`)
  } catch (error) {
    if (error instanceof Error && error.name === 'ResourceInUseException') {
      console.log(`ℹ️  Table ${tableName} already exists`)
    } else {
      throw error
    }
  }
}

/**
 * Delete MediaDownloader table from LocalStack
 * Used for cleanup in tests
 *
 * @returns Promise that resolves when table is deleted
 */
export async function cleanupLocalStackTable(): Promise<void> {
  const client = new DynamoDBClient({
    endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
  })

  const tableName = process.env.DynamoDBTableName || 'MediaDownloader'

  try {
    const { DeleteTableCommand } = await import('@aws-sdk/client-dynamodb')
    await client.send(new DeleteTableCommand({ TableName: tableName }))
    console.log(`🗑️  Deleted table: ${tableName}`)
  } catch (error) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      console.log(`ℹ️  Table ${tableName} does not exist`)
    } else {
      console.error('Error deleting table:', error)
    }
  }
}
