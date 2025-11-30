export enum UserStatus {
  Authenticated,
  Unauthenticated,
  Anonymous
}

/**
 * File status for permanent media records.
 *
 * These are FINAL states only - all transient/orchestration states
 * (retries, scheduling, in_progress) are in FileDownloads.DownloadStatus.
 *
 * - pending: File record exists, download not yet complete
 * - available: Successfully downloaded, ready for users
 * - unavailable: Permanently failed, will not be available
 */
export enum FileStatus {
  Pending = 'pending',
  Available = 'available',
  Unavailable = 'unavailable'
}

export enum ResponseStatus {
  Dispatched = 'Dispatched',
  Initiated = 'Initiated',
  Accepted = 'Accepted',
  Success = 'Success'
}
