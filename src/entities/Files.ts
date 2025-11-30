import {documentClient, Entity} from '#lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for the Files DynamoDB table.
 * This entity manages media file metadata and download status.
 */
export const Files = new Entity(
  {
    model: {entity: 'File', version: '1', service: 'MediaDownloader'},
    attributes: {
      fileId: {type: 'string', required: true, readOnly: true},
      availableAt: {type: 'number', required: true},
      size: {type: 'number', required: true, default: 0},
      authorName: {type: 'string', required: true},
      authorUser: {type: 'string', required: true},
      publishDate: {type: 'string', required: true},
      description: {type: 'string', required: true},
      key: {type: 'string', required: true},
      url: {type: 'string', required: false},
      contentType: {type: 'string', required: true},
      title: {type: 'string', required: true},
      status: {
        type: ['PendingMetadata', 'PendingDownload', 'Downloaded', 'Failed'] as const,
        required: true,
        default: 'PendingMetadata'
      }
    },
    indexes: {
      primary: {pk: {field: 'pk', composite: ['fileId'] as const}, sk: {field: 'sk', composite: [] as const}},
      byStatus: {
        index: 'StatusIndex',
        pk: {field: 'gsi4pk', composite: ['status'] as const},
        sk: {field: 'gsi4sk', composite: ['availableAt'] as const}
      },
      byKey: {
        index: 'KeyIndex',
        pk: {field: 'gsi5pk', composite: ['key'] as const},
        sk: {field: 'sk', composite: [] as const}
      }
    }
  } as const,
  {table: process.env.DynamoDBTableName, client: documentClient}
)

// Type exports for use in application code
export type FileItem = ReturnType<typeof Files.parse>
export type CreateFileInput = Parameters<typeof Files.create>[0]
export type UpdateFileInput = Parameters<typeof Files.update>[0]
