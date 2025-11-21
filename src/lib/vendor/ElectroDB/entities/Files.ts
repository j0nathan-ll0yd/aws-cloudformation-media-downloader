import {Entity} from 'electrodb'

/**
 * ElectroDB entity schema for the Files DynamoDB table.
 * This entity manages media file metadata and download status.
 */
export const Files = new Entity({
  model: {
    entity: 'File',
    version: '1',
    service: 'MediaDownloader'
  },
  attributes: {
    fileId: {
      type: 'string',
      required: true,
      readOnly: true
    },
    availableAt: {
      type: 'number',
      required: true
    },
    size: {
      type: 'number',
      required: true,
      default: 0
    },
    authorName: {
      type: 'string',
      required: true
    },
    authorUser: {
      type: 'string',
      required: true
    },
    publishDate: {
      type: 'string',
      required: true
    },
    description: {
      type: 'string',
      required: true
    },
    key: {
      type: 'string',
      required: true
    },
    url: {
      type: 'string',
      required: false
    },
    contentType: {
      type: 'string',
      required: true
    },
    title: {
      type: 'string',
      required: true
    },
    status: {
      type: ['PendingMetadata', 'PendingDownload', 'Downloaded', 'Failed'] as const,
      required: true,
      default: 'PendingMetadata'
    }
  },
  indexes: {
    primary: {
      pk: {
        field: 'fileId',
        composite: ['fileId']
      }
    },
    byStatus: {
      index: 'gsi1',
      pk: {
        field: 'gsi1pk',
        composite: ['status']
      },
      sk: {
        field: 'gsi1sk',
        composite: ['availableAt']
      }
    },
    byKey: {
      index: 'gsi2',
      pk: {
        field: 'gsi2pk',
        composite: ['key']
      }
    }
  }
})

// Type exports for use in application code
export type FileItem = ReturnType<typeof Files.parse>
export type CreateFileInput = Parameters<typeof Files.create>[0]
export type UpdateFileInput = Parameters<typeof Files.update>[0]
