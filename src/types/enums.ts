export enum UserStatus {
  Authenticated,
  Unauthenticated,
  Anonymous
}

/**
 * File status for permanent media records.
 *
 * These are FINAL states only - all transient/orchestration states
 * (retries, scheduling, in_progress) are in DownloadStatus.
 *
 * - Queued: File record exists, download not yet complete
 * - Downloading: Currently being downloaded
 * - Downloaded: Successfully downloaded, ready for users
 * - Failed: Permanently failed, will not be available
 */
export enum FileStatus {
  Queued = 'Queued',
  Downloading = 'Downloading',
  Downloaded = 'Downloaded',
  Failed = 'Failed'
}

/**
 * Download status for transient orchestration state.
 *
 * Tracks the download lifecycle in FileDownloads entity:
 * - pending: Queued, waiting for FileCoordinator to pick up
 * - in_progress: Currently being downloaded
 * - scheduled: Failed but scheduled for retry (retryAfter set)
 * - completed: Successfully downloaded (can be cleaned up)
 * - failed: Permanently failed, no more retries
 */
export enum DownloadStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Scheduled = 'scheduled',
  Completed = 'completed',
  Failed = 'failed'
}

export enum ResponseStatus {
  Dispatched = 'Dispatched',
  Initiated = 'Initiated',
  Accepted = 'Accepted',
  Success = 'Success'
}
