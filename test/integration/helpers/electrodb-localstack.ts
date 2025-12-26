import {CreateTableCommand, DynamoDBClient} from '@aws-sdk/client-dynamodb'

/**
 * Setup MediaDownloader DynamoDB table in LocalStack
 * Creates table with all required GSIs for ElectroDB entities
 * Matches production Terraform configuration (main.tf)
 *
 * @returns Promise that resolves when table is created
 */
export async function setupLocalStackTable(): Promise<void> {
  const client = new DynamoDBClient({
    endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
    region: process.env.AWS_REGION || 'us-west-2',
    credentials: {accessKeyId: 'test', secretAccessKey: 'test'}
  })

  const tableName = process.env.DynamoDBTableName || 'MediaDownloader'

  try {
    await client.send(new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [
        {AttributeName: 'pk', AttributeType: 'S'},
        {AttributeName: 'sk', AttributeType: 'S'},
        {AttributeName: 'gsi1pk', AttributeType: 'S'},
        {AttributeName: 'gsi1sk', AttributeType: 'S'},
        {AttributeName: 'gsi2pk', AttributeType: 'S'},
        {AttributeName: 'gsi2sk', AttributeType: 'S'},
        {AttributeName: 'gsi3pk', AttributeType: 'S'},
        {AttributeName: 'gsi3sk', AttributeType: 'S'},
        {AttributeName: 'gsi4pk', AttributeType: 'S'},
        {AttributeName: 'gsi4sk', AttributeType: 'S'},
        {AttributeName: 'gsi5pk', AttributeType: 'S'},
        {AttributeName: 'gsi6pk', AttributeType: 'S'},
        {AttributeName: 'gsi6sk', AttributeType: 'S'},
        {AttributeName: 'gsi7pk', AttributeType: 'S'},
        {AttributeName: 'gsi7sk', AttributeType: 'S'},
        {AttributeName: 'gsi8pk', AttributeType: 'S'},
        {AttributeName: 'gsi8sk', AttributeType: 'S'},
        {AttributeName: 'gsi9pk', AttributeType: 'S'},
        {AttributeName: 'gsi9sk', AttributeType: 'S'},
        {AttributeName: 'gsi10pk', AttributeType: 'S'},
        {AttributeName: 'gsi10sk', AttributeType: 'S'}
      ],
      KeySchema: [
        {AttributeName: 'pk', KeyType: 'HASH'},
        {AttributeName: 'sk', KeyType: 'RANGE'}
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'UserCollection',
          KeySchema: [{AttributeName: 'gsi1pk', KeyType: 'HASH'}, {AttributeName: 'gsi1sk', KeyType: 'RANGE'}],
          Projection: {ProjectionType: 'ALL'}
        },
        {
          IndexName: 'FileCollection',
          KeySchema: [{AttributeName: 'gsi2pk', KeyType: 'HASH'}, {AttributeName: 'gsi2sk', KeyType: 'RANGE'}],
          Projection: {ProjectionType: 'ALL'}
        },
        {
          IndexName: 'DeviceCollection',
          KeySchema: [{AttributeName: 'gsi3pk', KeyType: 'HASH'}, {AttributeName: 'gsi3sk', KeyType: 'RANGE'}],
          Projection: {ProjectionType: 'ALL'}
        },
        {
          IndexName: 'StatusIndex',
          KeySchema: [{AttributeName: 'gsi4pk', KeyType: 'HASH'}, {AttributeName: 'gsi4sk', KeyType: 'RANGE'}],
          Projection: {ProjectionType: 'ALL'}
        },
        {IndexName: 'KeyIndex', KeySchema: [{AttributeName: 'gsi5pk', KeyType: 'HASH'}], Projection: {ProjectionType: 'ALL'}},
        {
          IndexName: 'GSI6',
          KeySchema: [{AttributeName: 'gsi6pk', KeyType: 'HASH'}, {AttributeName: 'gsi6sk', KeyType: 'RANGE'}],
          Projection: {ProjectionType: 'ALL'}
        },
        {
          IndexName: 'AppleDeviceIndex',
          KeySchema: [{AttributeName: 'gsi7pk', KeyType: 'HASH'}, {AttributeName: 'gsi7sk', KeyType: 'RANGE'}],
          Projection: {ProjectionType: 'ALL'}
        },
        {
          IndexName: 'EmailIndex',
          KeySchema: [{AttributeName: 'gsi8pk', KeyType: 'HASH'}, {AttributeName: 'gsi8sk', KeyType: 'RANGE'}],
          Projection: {ProjectionType: 'ALL'}
        },
        {
          IndexName: 'TokenIndex',
          KeySchema: [{AttributeName: 'gsi9pk', KeyType: 'HASH'}, {AttributeName: 'gsi9sk', KeyType: 'RANGE'}],
          Projection: {ProjectionType: 'ALL'}
        },
        {
          IndexName: 'ProviderIndex',
          KeySchema: [{AttributeName: 'gsi10pk', KeyType: 'HASH'}, {AttributeName: 'gsi10sk', KeyType: 'RANGE'}],
          Projection: {ProjectionType: 'ALL'}
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }))

    if (process.env.LOG_LEVEL !== 'SILENT') {
      console.log(`✅ Created table: ${tableName}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ResourceInUseException') {
      if (process.env.LOG_LEVEL !== 'SILENT') {
        console.log(`ℹ️  Table ${tableName} already exists`)
      }
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
    region: process.env.AWS_REGION || 'us-west-2',
    credentials: {accessKeyId: 'test', secretAccessKey: 'test'}
  })

  const tableName = process.env.DynamoDBTableName || 'MediaDownloader'

  try {
    const {DeleteTableCommand} = await import('@aws-sdk/client-dynamodb')
    await client.send(new DeleteTableCommand({TableName: tableName}))
    if (process.env.LOG_LEVEL !== 'SILENT') {
      console.log(`🗑️  Deleted table: ${tableName}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      if (process.env.LOG_LEVEL !== 'SILENT') {
        console.log(`ℹ️  Table ${tableName} does not exist`)
      }
    } else {
      console.error('Error deleting table:', error)
    }
  }
}
