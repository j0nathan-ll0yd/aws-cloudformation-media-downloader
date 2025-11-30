export enum UserStatus {
  Authenticated,
  Unauthenticated,
  Anonymous
}

/**
 * File status for permanent media records.
 * Note: 'Scheduled' status is now in FileDownloads entity (DownloadStatus)
 */
export enum FileStatus {
  PendingMetadata = 'PendingMetadata',
  PendingDownload = 'PendingDownload',
  Downloaded = 'Downloaded',
  Failed = 'Failed'
}

export enum ResponseStatus {
  Dispatched = 'Dispatched',
  Initiated = 'Initiated',
  Accepted = 'Accepted',
  Success = 'Success'
}
