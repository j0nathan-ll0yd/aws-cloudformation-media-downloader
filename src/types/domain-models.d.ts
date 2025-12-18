import {FileStatus} from './enums'

export interface User {
  userId: string
  email: string
  emailVerified: boolean
  firstName: string
  lastName?: string
}

/**
 * Media file metadata.
 * Status values: 'Queued' | 'Downloading' | 'Downloaded' | 'Failed'
 */
export interface File {
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

export interface Device {
  name: string
  token: string
  systemVersion: string
  deviceId: string
  systemName: string
  endpointArn: string
}

export interface IdentityProvider {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresAt: number
}
