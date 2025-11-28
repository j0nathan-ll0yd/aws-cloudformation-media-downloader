import {CreateTableCommand, DynamoDBClient} from '@aws-sdk/client-dynamodb'

/**
 * Setup MediaDownloader DynamoDB table in LocalStack
 * Creates table with all required GSIs for ElectroDB entities
 *
 * Table Design:
 * - Primary Key: PK (HASH), SK (RANGE)
 * - GSI1: GSI1PK (HASH), GSI1SK (RANGE) - UserCollection (userResources)
 * - GSI2: GSI2PK (HASH), GSI2SK (RANGE) - FileCollection (fileUsers)
 * - GSI3: GSI3PK (HASH), GSI3SK (RANGE) - DeviceCollection (deviceUsers)
 *
 * @returns Promise that resolves when table is created
 */
export async function setupLocalStackTable(): Promise<void> {
  const client = new DynamoDBClient({
    endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  })

  const tableName = process.env.DynamoDBTableName || 'MediaDownloader'

  try {
    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        AttributeDefinitions: [
          {AttributeName: 'PK', AttributeType: 'S'},
          {AttributeName: 'SK', AttributeType: 'S'},
          {AttributeName: 'GSI1PK', AttributeType: 'S'},
          {AttributeName: 'GSI1SK', AttributeType: 'S'},
          {AttributeName: 'GSI2PK', AttributeType: 'S'},
          {AttributeName: 'GSI2SK', AttributeType: 'S'},
          {AttributeName: 'GSI3PK', AttributeType: 'S'},
          {AttributeName: 'GSI3SK', AttributeType: 'S'}
        ],
        KeySchema: [
          {AttributeName: 'PK', KeyType: 'HASH'},
          {AttributeName: 'SK', KeyType: 'RANGE'}
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'gsi1',
            KeySchema: [
              {AttributeName: 'GSI1PK', KeyType: 'HASH'},
              {AttributeName: 'GSI1SK', KeyType: 'RANGE'}
            ],
            Projection: {ProjectionType: 'ALL'}
          },
          {
            IndexName: 'gsi2',
            KeySchema: [
              {AttributeName: 'GSI2PK', KeyType: 'HASH'},
              {AttributeName: 'GSI2SK', KeyType: 'RANGE'}
            ],
            Projection: {ProjectionType: 'ALL'}
          },
          {
            IndexName: 'gsi3',
            KeySchema: [
              {AttributeName: 'GSI3PK', KeyType: 'HASH'},
              {AttributeName: 'GSI3SK', KeyType: 'RANGE'}
            ],
            Projection: {ProjectionType: 'ALL'}
          }
        ],
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
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  })

  const tableName = process.env.DynamoDBTableName || 'MediaDownloader'

  try {
    const {DeleteTableCommand} = await import('@aws-sdk/client-dynamodb')
    await client.send(new DeleteTableCommand({TableName: tableName}))
    console.log(`🗑️  Deleted table: ${tableName}`)
  } catch (error) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      console.log(`ℹ️  Table ${tableName} does not exist`)
    } else {
      console.error('Error deleting table:', error)
    }
  }
}
