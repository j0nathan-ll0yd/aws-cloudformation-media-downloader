export enum UserStatus {
  Authenticated,
  Unauthenticated,
  Anonymous
}

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
