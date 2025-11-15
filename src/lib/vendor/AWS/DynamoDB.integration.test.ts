/**
 * Integration tests for DynamoDB operations using LocalStack
 *
 * These tests verify DynamoDB functionality against a local AWS emulator
 */

import {describe, expect, test, beforeAll, afterEach} from '@jest/globals'
import {PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand} from '@aws-sdk/lib-dynamodb'
import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb'
import {createLocalDynamoDBClient} from '../../../util/localstack-helpers'
import {randomUUID} from 'crypto'

describe('DynamoDB Operations (LocalStack Integration)', () => {
  let docClient: DynamoDBDocument
  const testTable = 'Files'
  const createdIds: string[] = []

  beforeAll(() => {
    const client = createLocalDynamoDBClient()
    docClient = DynamoDBDocument.from(client)
  })

  afterEach(async () => {
    // Cleanup all created items
    for (const id of createdIds) {
      try {
        await docClient.send(
          new DeleteCommand({
            TableName: testTable,
            Key: {id}
          })
        )
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    createdIds.length = 0
  })

  test('should put and get an item from DynamoDB', async () => {
    const testId = randomUUID()
    createdIds.push(testId)

    const testItem = {
      id: testId,
      title: 'Test Video',
      url: 'https://example.com/video',
      status: 'Pending',
      createdAt: new Date().toISOString()
    }

    // Put item
    await docClient.send(
      new PutCommand({
        TableName: testTable,
        Item: testItem
      })
    )

    // Get item
    const result = await docClient.send(
      new GetCommand({
        TableName: testTable,
        Key: {id: testId}
      })
    )

    expect(result.Item).toBeDefined()
    expect(result.Item!.id).toBe(testId)
    expect(result.Item!.title).toBe('Test Video')
    expect(result.Item!.status).toBe('Pending')
  })

  test('should update an item in DynamoDB', async () => {
    const testId = randomUUID()
    createdIds.push(testId)

    // Put initial item
    await docClient.send(
      new PutCommand({
        TableName: testTable,
        Item: {
          id: testId,
          title: 'Original Title',
          status: 'Pending'
        }
      })
    )

    // Update item
    await docClient.send(
      new UpdateCommand({
        TableName: testTable,
        Key: {id: testId},
        UpdateExpression: 'SET #status = :status, #title = :title',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#title': 'title'
        },
        ExpressionAttributeValues: {
          ':status': 'Downloaded',
          ':title': 'Updated Title'
        }
      })
    )

    // Verify update
    const result = await docClient.send(
      new GetCommand({
        TableName: testTable,
        Key: {id: testId}
      })
    )

    expect(result.Item!.status).toBe('Downloaded')
    expect(result.Item!.title).toBe('Updated Title')
  })

  test('should delete an item from DynamoDB', async () => {
    const testId = randomUUID()

    // Put item
    await docClient.send(
      new PutCommand({
        TableName: testTable,
        Item: {
          id: testId,
          title: 'Item to Delete'
        }
      })
    )

    // Delete item
    await docClient.send(
      new DeleteCommand({
        TableName: testTable,
        Key: {id: testId}
      })
    )

    // Verify item was deleted
    const result = await docClient.send(
      new GetCommand({
        TableName: testTable,
        Key: {id: testId}
      })
    )

    expect(result.Item).toBeUndefined()
  })

  test('should scan table for items', async () => {
    // Put multiple test items
    const testIds = [randomUUID(), randomUUID(), randomUUID()]
    createdIds.push(...testIds)

    for (const id of testIds) {
      await docClient.send(
        new PutCommand({
          TableName: testTable,
          Item: {
            id,
            title: `Test Item ${id}`,
            status: 'Pending'
          }
        })
      )
    }

    // Scan table
    const result = await docClient.send(
      new ScanCommand({
        TableName: testTable
      })
    )

    expect(result.Items).toBeDefined()
    expect(result.Items!.length).toBeGreaterThanOrEqual(testIds.length)

    // Verify our test items are in the results
    const resultIds = result.Items!.map((item) => item.id)
    for (const id of testIds) {
      expect(resultIds).toContain(id)
    }
  })

  test('should handle non-existent item gracefully', async () => {
    const nonExistentId = randomUUID()

    const result = await docClient.send(
      new GetCommand({
        TableName: testTable,
        Key: {id: nonExistentId}
      })
    )

    expect(result.Item).toBeUndefined()
  })
})
