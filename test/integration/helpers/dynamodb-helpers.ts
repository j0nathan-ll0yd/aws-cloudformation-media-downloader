/**
 * DynamoDB Test Helpers
 *
 * Utilities for inserting and querying test data in LocalStack DynamoDB
 */

import {createDynamoDBClient} from '../../../src/lib/vendor/AWS/clients'
import {
  CreateTableCommand,
  PutItemCommand,
  GetItemCommand,
  ScanCommand,
  DeleteTableCommand,
  AttributeValue
} from '@aws-sdk/client-dynamodb'
import {DynamoDBFile} from '../../../src/types/main'
import {FileStatus} from '../../../src/types/enums'

const dynamoDBClient = createDynamoDBClient()

// Table names from environment
const FILES_TABLE = process.env.DynamoDBTableFiles || 'test-files'
const USERS_TABLE = process.env.DynamoDBTableUsers || 'test-users'

/**
 * Create test Files table in LocalStack
 */
export async function createFilesTable(): Promise<void> {
  try {
    await dynamoDBClient.send(
      new CreateTableCommand({
        TableName: FILES_TABLE,
        KeySchema: [{AttributeName: 'fileId', KeyType: 'HASH'}],
        AttributeDefinitions: [{AttributeName: 'fileId', AttributeType: 'S'}],
        BillingMode: 'PAY_PER_REQUEST'
      })
    )
  } catch (error) {
    // Table might already exist
    if (!(error instanceof Error && error.name === 'ResourceInUseException')) {
      throw error
    }
  }
}

/**
 * Create test Users table in LocalStack
 */
export async function createUsersTable(): Promise<void> {
  try {
    await dynamoDBClient.send(
      new CreateTableCommand({
        TableName: USERS_TABLE,
        KeySchema: [{AttributeName: 'userId', KeyType: 'HASH'}],
        AttributeDefinitions: [{AttributeName: 'userId', AttributeType: 'S'}],
        BillingMode: 'PAY_PER_REQUEST'
      })
    )
  } catch (error) {
    // Table might already exist
    if (!(error instanceof Error && error.name === 'ResourceInUseException')) {
      throw error
    }
  }
}

/**
 * Delete test Files table from LocalStack
 */
export async function deleteFilesTable(): Promise<void> {
  try {
    await dynamoDBClient.send(new DeleteTableCommand({TableName: FILES_TABLE}))
  } catch (error) {
    // Table might not exist
  }
}

/**
 * Delete test Users table from LocalStack
 */
export async function deleteUsersTable(): Promise<void> {
  try {
    await dynamoDBClient.send(new DeleteTableCommand({TableName: USERS_TABLE}))
  } catch (error) {
    // Table might not exist
  }
}

/**
 * Insert a file record into DynamoDB
 */
export async function insertFile(file: Partial<DynamoDBFile>): Promise<void> {
  const item: Record<string, AttributeValue> = {
    fileId: {S: file.fileId!},
    status: {S: file.status || FileStatus.Pending}
  }

  if (file.key) item.key = {S: file.key}
  if (file.size !== undefined) item.size = {N: file.size.toString()}
  if (file.availableAt) item.availableAt = {N: file.availableAt.toString()}
  if (file.authorName) item.authorName = {S: file.authorName}
  if (file.authorUser) item.authorUser = {S: file.authorUser}
  if (file.title) item.title = {S: file.title}
  if (file.description) item.description = {S: file.description}
  if (file.publishDate) item.publishDate = {S: file.publishDate}
  if (file.contentType) item.contentType = {S: file.contentType}

  await dynamoDBClient.send(
    new PutItemCommand({
      TableName: FILES_TABLE,
      Item: item
    })
  )
}

/**
 * Get a file record from DynamoDB
 */
export async function getFile(fileId: string): Promise<DynamoDBFile | null> {
  const response = await dynamoDBClient.send(
    new GetItemCommand({
      TableName: FILES_TABLE,
      Key: {fileId: {S: fileId}}
    })
  )

  if (!response.Item) {
    return null
  }

  return {
    fileId: response.Item.fileId.S!,
    status: response.Item.status.S as FileStatus,
    key: response.Item.key?.S,
    size: response.Item.size?.N ? parseInt(response.Item.size.N) : undefined,
    availableAt: response.Item.availableAt?.N ? parseInt(response.Item.availableAt.N) : undefined,
    authorName: response.Item.authorName?.S,
    authorUser: response.Item.authorUser?.S,
    title: response.Item.title?.S,
    description: response.Item.description?.S,
    publishDate: response.Item.publishDate?.S,
    contentType: response.Item.contentType?.S
  }
}

/**
 * Scan all files from DynamoDB
 */
export async function scanAllFiles(): Promise<DynamoDBFile[]> {
  const response = await dynamoDBClient.send(
    new ScanCommand({
      TableName: FILES_TABLE
    })
  )

  if (!response.Items) {
    return []
  }

  return response.Items.map((item) => ({
    fileId: item.fileId.S!,
    status: item.status.S as FileStatus,
    key: item.key?.S,
    size: item.size?.N ? parseInt(item.size.N) : undefined,
    availableAt: item.availableAt?.N ? parseInt(item.availableAt.N) : undefined,
    authorName: item.authorName?.S,
    authorUser: item.authorUser?.S,
    title: item.title?.S,
    description: item.description?.S,
    publishDate: item.publishDate?.S,
    contentType: item.contentType?.S
  }))
}

/**
 * Insert multiple pending files for testing FileCoordinator
 */
export async function insertPendingFiles(fileIds: string[]): Promise<void> {
  await Promise.all(
    fileIds.map((fileId) =>
      insertFile({
        fileId,
        status: FileStatus.Pending,
        title: `Test Video ${fileId}`
      })
    )
  )
}
