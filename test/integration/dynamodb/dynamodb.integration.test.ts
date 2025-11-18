/**
 * DynamoDB Integration Tests
 *
 * Tests DynamoDB vendor wrapper functions against LocalStack to verify:
 * - Item creation using putItem
 * - Item updates using updateItem
 * - Item queries using query
 * - Table scans using scan
 * - Item deletion using deleteItem
 * - Real AWS SDK interactions without mocking
 */

import {describe, test, expect, beforeAll, afterAll, afterEach} from '@jest/globals'
import {putItem, updateItem, query, scan, deleteItem} from '../../../src/lib/vendor/AWS/DynamoDB'
import {createDynamoDBClient} from '../../../src/lib/vendor/AWS/clients'
import {CreateTableCommand, DeleteTableCommand, KeyType, ScalarAttributeType} from '@aws-sdk/client-dynamodb'

const TEST_TABLE = 'test-integration-table'

describe('DynamoDB Integration Tests', () => {
  let dynamoClient: ReturnType<typeof createDynamoDBClient>

  beforeAll(async () => {
    // Create DynamoDB client for test setup/teardown
    dynamoClient = createDynamoDBClient()

    // Create test table in LocalStack
    try {
      await dynamoClient.send(
        new CreateTableCommand({
          TableName: TEST_TABLE,
          KeySchema: [
            {AttributeName: 'pk', KeyType: KeyType.HASH},
            {AttributeName: 'sk', KeyType: KeyType.RANGE}
          ],
          AttributeDefinitions: [
            {AttributeName: 'pk', AttributeType: ScalarAttributeType.S},
            {AttributeName: 'sk', AttributeType: ScalarAttributeType.S}
          ],
          BillingMode: 'PAY_PER_REQUEST'
        })
      )

      // Wait for table to be active
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.log('Test table creation failed (may already exist):', error)
    }
  })

  afterAll(async () => {
    // Clean up test table
    try {
      await dynamoClient.send(new DeleteTableCommand({TableName: TEST_TABLE}))
    } catch (error) {
      console.log('Table cleanup failed:', error)
    }
  })

  afterEach(async () => {
    // Clean up test items after each test
    try {
      const items = await scan({TableName: TEST_TABLE})
      if (items.Items && items.Items.length > 0) {
        for (const item of items.Items) {
          await deleteItem({
            TableName: TEST_TABLE,
            Key: {pk: item.pk, sk: item.sk}
          })
        }
      }
    } catch (error) {
      console.log('Item cleanup failed:', error)
    }
  })

  test('should create item using putItem', async () => {
    // Arrange
    const testItem = {
      pk: 'test-partition',
      sk: 'test-sort',
      data: 'test data',
      timestamp: Date.now()
    }

    // Act
    const result = await putItem({
      TableName: TEST_TABLE,
      Item: testItem
    })

    // Assert
    expect(result).toBeDefined()

    // Verify item was created
    const scanResult = await scan({TableName: TEST_TABLE})
    expect(scanResult.Items).toHaveLength(1)
    expect(scanResult.Items![0]).toMatchObject(testItem)
  })

  test('should update item using updateItem', async () => {
    // Arrange - create initial item
    const initialItem = {
      pk: 'test-partition',
      sk: 'test-sort',
      data: 'initial data',
      count: 0
    }
    await putItem({TableName: TEST_TABLE, Item: initialItem})

    // Act - update item
    await updateItem({
      TableName: TEST_TABLE,
      Key: {pk: initialItem.pk, sk: initialItem.sk},
      UpdateExpression: 'SET #data = :newData, #count = :newCount',
      ExpressionAttributeNames: {
        '#data': 'data',
        '#count': 'count'
      },
      ExpressionAttributeValues: {
        ':newData': 'updated data',
        ':newCount': 1
      }
    })

    // Assert
    const scanResult = await scan({TableName: TEST_TABLE})
    expect(scanResult.Items).toHaveLength(1)
    expect(scanResult.Items![0].data).toBe('updated data')
    expect(scanResult.Items![0].count).toBe(1)
  })

  test('should query items using query', async () => {
    // Arrange - create multiple items with same partition key
    const pk = 'query-test-pk'
    const items = [
      {pk, sk: 'item-1', data: 'first'},
      {pk, sk: 'item-2', data: 'second'},
      {pk, sk: 'item-3', data: 'third'}
    ]

    for (const item of items) {
      await putItem({TableName: TEST_TABLE, Item: item})
    }

    // Act
    const result = await query({
      TableName: TEST_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': pk
      }
    })

    // Assert
    expect(result.Items).toHaveLength(3)
    expect(result.Items!.map(i => i.sk)).toEqual(['item-1', 'item-2', 'item-3'])
  })

  test('should scan table using scan', async () => {
    // Arrange - create multiple items
    const items = [
      {pk: 'pk-1', sk: 'sk-1', data: 'data-1'},
      {pk: 'pk-2', sk: 'sk-2', data: 'data-2'},
      {pk: 'pk-3', sk: 'sk-3', data: 'data-3'}
    ]

    for (const item of items) {
      await putItem({TableName: TEST_TABLE, Item: item})
    }

    // Act
    const result = await scan({TableName: TEST_TABLE})

    // Assert
    expect(result.Items).toHaveLength(3)
  })

  test('should delete item using deleteItem', async () => {
    // Arrange - create item
    const testItem = {
      pk: 'delete-test-pk',
      sk: 'delete-test-sk',
      data: 'to be deleted'
    }
    await putItem({TableName: TEST_TABLE, Item: testItem})

    // Verify item exists
    let scanResult = await scan({TableName: TEST_TABLE})
    expect(scanResult.Items).toHaveLength(1)

    // Act - delete item
    await deleteItem({
      TableName: TEST_TABLE,
      Key: {pk: testItem.pk, sk: testItem.sk}
    })

    // Assert - item should be deleted
    scanResult = await scan({TableName: TEST_TABLE})
    expect(scanResult.Items).toHaveLength(0)
  })
})
