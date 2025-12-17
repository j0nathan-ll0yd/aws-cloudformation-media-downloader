import {FileStatus} from './enums'

/**
 * Permanent media file metadata.
 *
 * This contains ONLY permanent metadata about the media file.
 * Transient download state (retries, scheduling, errors) is in FileDownloads entity.
 *
 * Status values: 'Queued' | 'Downloading' | 'Downloaded' | 'Failed'
 */
export interface FileRecord {
  fileId: string
  size: number
  authorName: string
  authorUser: string
  publishDate: string
  description: string
  key: string
  url?: string
  contentType: string
  title: string
  status: FileStatus
}

export interface UserDeviceRecord {
  userId: string
  deviceId: string
}

export interface UserFile {
  fileId: string
  userId: string
}
