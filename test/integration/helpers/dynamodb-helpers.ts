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
function getFilesTable() {
  return process.env.DynamoDBTableFiles || 'test-files'
}

function getUsersTable() {
  return process.env.DynamoDBTableUsers || 'test-users'
}

function getUserFilesTable() {
  return process.env.DynamoDBTableUserFiles || 'test-user-files'
}

/**
 * Create test Files table in LocalStack
 */
export async function createFilesTable(): Promise<void> {
  try {
    await dynamoDBClient.send(
      new CreateTableCommand({
        TableName: getFilesTable(),
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
        TableName: getUsersTable(),
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
 * Create test UserFiles table in LocalStack
 */
export async function createUserFilesTable(): Promise<void> {
  try {
    await dynamoDBClient.send(
      new CreateTableCommand({
        TableName: getUserFilesTable(),
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
    await dynamoDBClient.send(new DeleteTableCommand({TableName: getFilesTable()}))
  } catch (error) {
    // Table might not exist
  }
}

/**
 * Delete test Users table from LocalStack
 */
export async function deleteUsersTable(): Promise<void> {
  try {
    await dynamoDBClient.send(new DeleteTableCommand({TableName: getUsersTable()}))
  } catch (error) {
    // Table might not exist
  }
}

/**
 * Delete test UserFiles table from LocalStack
 */
export async function deleteUserFilesTable(): Promise<void> {
  try {
    await dynamoDBClient.send(new DeleteTableCommand({TableName: getUserFilesTable()}))
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
    status: {S: file.status || FileStatus.PendingMetadata}
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
      TableName: getFilesTable(),
      Item: item
    })
  )
}

/**
 * Get a file record from DynamoDB
 */
export async function getFile(fileId: string): Promise<Partial<DynamoDBFile> | null> {
  const response = await dynamoDBClient.send(
    new GetItemCommand({
      TableName: getFilesTable(),
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
export async function scanAllFiles(): Promise<Partial<DynamoDBFile>[]> {
  const response = await dynamoDBClient.send(
    new ScanCommand({
      TableName: getFilesTable()
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
        status: FileStatus.PendingMetadata,
        title: `Test Video ${fileId}`
      })
    )
  )
}
