export enum UserStatus {
  Authenticated,
  Unauthenticated,
  Anonymous
}

export enum FileStatus {
  PendingMetadata = 'PendingMetadata',
  PendingDownload = 'PendingDownload',
  Downloaded = 'Downloaded'
}
