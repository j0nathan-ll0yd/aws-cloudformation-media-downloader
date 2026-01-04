/** Input fields for generating an error fingerprint */
export interface FingerprintInput {
  /** Error type or constructor name */
  errorType: string
  /** Error code if available */
  errorCode?: string
  /** First stack frame (normalized, without line numbers) */
  stackFrame?: string
  /** Lambda function name where error occurred */
  lambdaName?: string
  /** Additional context for uniqueness */
  context?: string
}

/** Result of fingerprint generation */
export interface FingerprintResult {
  /** The generated fingerprint (12 char hex, prefixed with error-fp-) */
  fingerprint: string
  /** Human-readable summary of what was fingerprinted */
  summary: string
}

/** Result of issue creation with deduplication info */
export interface IssueResult {
  /** The issue number */
  issueNumber: number
  /** The issue URL */
  issueUrl: string
  /** Whether this was an existing issue (comment added) or new issue */
  isDuplicate: boolean
}
