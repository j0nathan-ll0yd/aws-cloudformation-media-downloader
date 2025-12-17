import {documentClient, Entity} from '#lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for the Files DynamoDB table.
 * This entity manages permanent media file metadata ONLY.
 *
 * Design Philosophy:
 * - Files = permanent metadata about media (title, author, size, etc.)
 * - FileDownloads = transient orchestration state (retries, scheduling, errors)
 *
 * Status values are minimal and final:
 * - Queued: File record created, download not yet complete
 * - Downloading: Download in progress
 * - Downloaded: Successfully downloaded, ready for users
 * - Failed: Permanently failed, will not be available
 *
 * All orchestration (retries, scheduling, error tracking) is in FileDownloads.
 *
 * @see FileDownloads for download orchestration state
 */
export const Files = new Entity({
  model: {entity: 'File', version: '1', service: 'MediaDownloader'},
  attributes: {
    /** YouTube video ID - primary identifier */
    fileId: {type: 'string', required: true, readOnly: true},
    /** File size in bytes (0 until downloaded) */
    size: {type: 'number', required: true, default: 0},
    /** Channel/author display name */
    authorName: {type: 'string', required: true},
    /** Channel/author username or ID */
    authorUser: {type: 'string', required: true},
    /** Video publish date (ISO string or timestamp) */
    publishDate: {type: 'string', required: true},
    /** Video description */
    description: {type: 'string', required: true},
    /** S3 object key */
    key: {type: 'string', required: true},
    /** Original source URL (YouTube URL) */
    url: {type: 'string', required: false},
    /** MIME type (e.g., video/mp4) */
    contentType: {type: 'string', required: true},
    /** Video title */
    title: {type: 'string', required: true},
    /** Final status: Queued (awaiting download), Downloading (in progress), Downloaded (ready), Failed (failed) */
    status: {type: ['Queued', 'Downloading', 'Downloaded', 'Failed'] as const, required: true, default: 'Queued'}
  },
  indexes: {
    primary: {pk: {field: 'pk', composite: ['fileId'] as const}, sk: {field: 'sk', composite: [] as const}},
    byKey: {index: 'KeyIndex', pk: {field: 'gsi5pk', composite: ['key'] as const}}
  }
} as const, {table: process.env.DynamoDBTableName, client: documentClient})

// Type exports for use in application code
export type FileItem = ReturnType<typeof Files.parse>
export type CreateFileInput = Parameters<typeof Files.create>[0]
export type UpdateFileInput = Parameters<typeof Files.update>[0]
