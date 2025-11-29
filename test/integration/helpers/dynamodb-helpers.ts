/**
 * DynamoDB Test Helpers
 *
 * Utilities for inserting and querying test data in LocalStack DynamoDB
 */

import {createTable, deleteTable} from '../lib/vendor/AWS/DynamoDB'
import {DynamoDBFile} from '../../../src/types/main'
import {FileStatus} from '../../../src/types/enums'
import {createMockFile} from './test-data'

function getMediaDownloaderTable() {
  return process.env.DynamoDBTableName || 'test-media-downloader'
}

/**
 * Create MediaDownloader table in LocalStack with single-table design
 * Matches production Terraform configuration with pk/sk and 5 GSIs
 */
export async function createMediaDownloaderTable(): Promise<void> {
  try {
    await createTable({
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
    await deleteTable(getMediaDownloaderTable())
  } catch {
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
 * Uses createMockFile for consistent defaults across all tests
 * This ensures proper entity metadata is added for ElectroDB compatibility
 */
export async function insertFile(file: Partial<DynamoDBFile>): Promise<void> {
  const {Files} = await import('../../../src/entities/Files')

  // Get consistent defaults from createMockFile, then apply user overrides
  const defaults = createMockFile(file.fileId!, file.status || FileStatus.PendingMetadata, file)

  // ElectroDB requires all fields - createMockFile provides them all
  await Files.create({
    fileId: defaults.fileId!,
    status: defaults.status!,
    availableAt: defaults.availableAt!,
    size: defaults.size!,
    key: defaults.key!,
    title: defaults.title!,
    description: defaults.description!,
    authorName: defaults.authorName!,
    authorUser: defaults.authorUser!,
    publishDate: defaults.publishDate!,
    contentType: defaults.contentType!,
    ...(defaults.url && {url: defaults.url})
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
