/**
 * DynamoDB Test Helpers
 *
 * Utilities for inserting and querying test data in LocalStack DynamoDB
 */

import {createDynamoDBClient} from '../../../src/lib/vendor/AWS/clients'
import {CreateTableCommand, ScanCommand, DeleteTableCommand} from '@aws-sdk/client-dynamodb'
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
 * Insert a file record into DynamoDB using ElectroDB
 * This ensures proper entity metadata is added for ElectroDB compatibility
 */
export async function insertFile(file: Partial<DynamoDBFile>): Promise<void> {
  const {Files} = await import('../../../src/lib/vendor/ElectroDB/entities/Files')

  // ElectroDB requires all fields, so provide defaults
  await Files.create({
    fileId: file.fileId!,
    status: file.status || FileStatus.PendingMetadata,
    availableAt: file.availableAt || Date.now(),
    size: file.size || 0,
    key: file.key || `${file.fileId}.mp4`,
    title: file.title || `Test Video ${file.fileId}`,
    description: file.description || 'Test video description',
    authorName: file.authorName || 'Test Author',
    authorUser: file.authorUser || 'testuser',
    publishDate: file.publishDate || new Date().toISOString(),
    contentType: file.contentType || 'video/mp4',
    ...(file.url && {url: file.url})
  }).go()
}

/**
 * Get a file record from DynamoDB using ElectroDB
 */
export async function getFile(fileId: string): Promise<Partial<DynamoDBFile> | null> {
  const {Files} = await import('../../../src/lib/vendor/ElectroDB/entities/Files')

  const response = await Files.get({fileId}).go()

  if (!response || !response.data) {
    return null
  }

  return response.data as Partial<DynamoDBFile>
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
