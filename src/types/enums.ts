/**
 * User authentication status from API Gateway custom authorizer.
 *
 * Determines which middleware wrapper to use and what access is granted.
 *
 * - Authenticated: Valid token, userId available
 * - Unauthenticated: Invalid/expired token, rejected with 401
 * - Anonymous: No token provided, allowed for some endpoints
 *
 * @see wrapAuthenticatedHandler - Requires Authenticated only
 * @see wrapOptionalAuthHandler - Allows Authenticated + Anonymous
 */
export enum UserStatus {
  /** Valid authentication token, userId guaranteed */
  Authenticated,
  /** Invalid or expired token, will be rejected with 401 */
  Unauthenticated,
  /** No token provided, may be allowed for certain endpoints */
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
  Pending = 'Pending',
  InProgress = 'InProgress',
  Scheduled = 'Scheduled',
  Completed = 'Completed',
  Failed = 'Failed'
}

/**
 * API response status values for async operations.
 *
 * Used to indicate the progress stage of asynchronous operations
 * that span multiple Lambda invocations.
 *
 * - Dispatched: Request queued/sent but not yet processing
 * - Initiated: Processing has begun
 * - Accepted: Request validated and accepted for processing
 * - Success: Operation completed successfully
 */
export enum ResponseStatus {
  /** Request has been sent/queued for processing */
  Dispatched = 'Dispatched',
  /** Processing has been initiated */
  Initiated = 'Initiated',
  /** Request validated and accepted */
  Accepted = 'Accepted',
  /** Operation completed successfully */
  Success = 'Success'
}
