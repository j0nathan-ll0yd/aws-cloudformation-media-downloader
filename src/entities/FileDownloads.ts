import {documentClient, Entity} from '#lib/vendor/ElectroDB/entity'

// Re-export DownloadStatus enum from enums for consumers of this module
export { DownloadStatus } from '#types/enums'

/**
 * ElectroDB entity schema for tracking download attempts.
 *
 * This entity manages transient download state, separating download orchestration
 * concerns from the permanent File entity. This enables:
 *
 * - Clean separation: Files = media metadata, FileDownloads = download state
 * - Retry tracking without polluting file records
 * - Easy cleanup of transient state after successful downloads
 * - Better querying for pending/scheduled downloads
 *
 * Lifecycle:
 * 1. Created when a download is initiated (status: 'pending' or 'in_progress')
 * 2. Updated on errors with retry scheduling (status: 'scheduled')
 * 3. Marked 'completed' on success (can be deleted after File updated)
 * 4. Marked 'failed' when retries exhausted
 */
export const FileDownloads = new Entity({
  model: {entity: 'FileDownload', version: '1', service: 'MediaDownloader'},
  attributes: {
    /** YouTube video ID - matches File.fileId */
    fileId: {type: 'string', required: true, readOnly: true},
    /** Current download status */
    status: {type: ['Pending', 'InProgress', 'Scheduled', 'Completed', 'Failed'] as const, required: true, default: 'Pending'},
    /** Number of download attempts made */
    retryCount: {type: 'number', required: true, default: 0},
    /** Maximum retries allowed for this download */
    maxRetries: {type: 'number', required: true, default: 5},
    /** Unix timestamp (seconds) when retry should be attempted */
    retryAfter: {type: 'number', required: false},
    /** Error category from video-error-classifier */
    errorCategory: {type: 'string', required: false},
    /** Human-readable error message */
    lastError: {type: 'string', required: false},
    /** Scheduled video release timestamp from yt-dlp (if known) */
    scheduledReleaseTime: {type: 'number', required: false},
    /** Source URL for the download */
    sourceUrl: {type: 'string', required: false},
    /** Timestamp when download was first initiated */
    createdAt: {type: 'number', required: true, default: () => Math.floor(Date.now() / 1000)},
    /** Timestamp when download state was last updated */
    updatedAt: {type: 'number', required: true, default: () => Math.floor(Date.now() / 1000), watch: '*'},
    /** Correlation ID for end-to-end request tracing across Lambda chain */
    correlationId: {type: 'string', required: false},
    /** Unix timestamp (seconds) for DynamoDB TTL - auto-delete completed/failed records */
    ttl: {type: 'number', required: false}
  },
  indexes: {
    primary: {pk: {field: 'pk', composite: ['fileId'] as const}, sk: {field: 'sk', composite: [] as const}},
    /** Query downloads by status and retry time - enables FileCoordinator to find ready downloads */
    byStatusRetryAfter: {index: 'GSI6', pk: {field: 'gsi6pk', composite: ['status'] as const}, sk: {field: 'gsi6sk', composite: ['retryAfter'] as const}}
  }
} as const, {table: process.env.DynamoDBTableName, client: documentClient})

// Type exports for use in application code
export type FileDownloadItem = ReturnType<typeof FileDownloads.parse>
export type CreateFileDownloadInput = Parameters<typeof FileDownloads.create>[0]
export type UpdateFileDownloadInput = Parameters<typeof FileDownloads.update>[0]
