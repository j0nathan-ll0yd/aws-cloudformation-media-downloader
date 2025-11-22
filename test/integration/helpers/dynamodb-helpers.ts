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

function getMediaDownloaderTable() {
  return process.env.DynamoDBTableName || 'test-media-downloader'
}

/**
 * Create MediaDownloader table in LocalStack with single-table design
 * Matches production Terraform configuration with pk/sk and 5 GSIs
 */
export async function createMediaDownloaderTable(): Promise<void> {
  try {
    await dynamoDBClient.send(
      new CreateTableCommand({
        TableName: getMediaDownloaderTable(),
        KeySchema: [
          {AttributeName: 'pk', KeyType: 'HASH'},
          {AttributeName: 'sk', KeyType: 'RANGE'}
        ],
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
          {AttributeName: 'gsi5sk', AttributeType: 'S'}
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'UserCollection',
            KeySchema: [
              {AttributeName: 'gsi1pk', KeyType: 'HASH'},
              {AttributeName: 'gsi1sk', KeyType: 'RANGE'}
            ],
            Projection: {ProjectionType: 'ALL'}
          },
          {
            IndexName: 'FileCollection',
            KeySchema: [
              {AttributeName: 'gsi2pk', KeyType: 'HASH'},
              {AttributeName: 'gsi2sk', KeyType: 'RANGE'}
            ],
            Projection: {ProjectionType: 'ALL'}
          },
          {
            IndexName: 'DeviceCollection',
            KeySchema: [
              {AttributeName: 'gsi3pk', KeyType: 'HASH'},
              {AttributeName: 'gsi3sk', KeyType: 'RANGE'}
            ],
            Projection: {ProjectionType: 'ALL'}
          },
          {
            IndexName: 'StatusIndex',
            KeySchema: [
              {AttributeName: 'gsi4pk', KeyType: 'HASH'},
              {AttributeName: 'gsi4sk', KeyType: 'RANGE'}
            ],
            Projection: {ProjectionType: 'ALL'}
          },
          {
            IndexName: 'KeyIndex',
            KeySchema: [
              {AttributeName: 'gsi5pk', KeyType: 'HASH'},
              {AttributeName: 'gsi5sk', KeyType: 'RANGE'}
            ],
            Projection: {ProjectionType: 'ALL'}
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      })
    )
  } catch (error) {
    if (!(error instanceof Error && error.name === 'ResourceInUseException')) {
      throw error
    }
  }
}

/**
 * Delete MediaDownloader table from LocalStack
 */
export async function deleteMediaDownloaderTable(): Promise<void> {
  try {
    await dynamoDBClient.send(new DeleteTableCommand({TableName: getMediaDownloaderTable()}))
  } catch (error) {
    // Table might not exist
  }
}

/**
 * Legacy aliases for backward compatibility - these call the new single-table functions
 * @deprecated Use createMediaDownloaderTable instead
 */
export const createFilesTable = createMediaDownloaderTable
export const createUsersTable = createMediaDownloaderTable
export const createUserFilesTable = createMediaDownloaderTable

/**
 * @deprecated Use deleteMediaDownloaderTable instead
 */
export const deleteFilesTable = deleteMediaDownloaderTable
export const deleteUsersTable = deleteMediaDownloaderTable
export const deleteUserFilesTable = deleteMediaDownloaderTable

/**
 * Insert a file record into DynamoDB using ElectroDB
 * This ensures proper entity metadata is added for ElectroDB compatibility
 */
export async function insertFile(file: Partial<DynamoDBFile>): Promise<void> {
  const {Files} = await import('../../../src/entities/Files')

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
  const {Files} = await import('../../../src/entities/Files')

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
      TableName: getMediaDownloaderTable()
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
