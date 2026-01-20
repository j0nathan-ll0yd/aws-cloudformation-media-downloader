/**
 * Test Constants
 *
 * Centralized constants for consistent test data across all Lambda tests.
 * Eliminates magic strings and improves test readability.
 *
 * @example
 * ```typescript
 * import {TEST_MESSAGE_ID, TEST_VIDEO_ID} from '#test/helpers/test-constants'
 *
 * event = createDownloadQueueEvent(TEST_VIDEO_ID, {messageId: TEST_MESSAGE_ID})
 * ```
 *
 * @see test/helpers/entity-fixtures.ts for entity-specific constants (DEFAULT_USER_ID, etc.)
 */

// ============================================================================
// Message and Event IDs
// ============================================================================

/** Generic test message ID for SQS/SNS messages */
export const TEST_MESSAGE_ID = 'msg-1234-5678-9abc-def012345678'

/** Correlation ID for tracing requests across services */
export const TEST_CORRELATION_ID = 'corr-1234-5678-9abc-def012345678'

/** EventBridge event ID */
export const TEST_EVENT_ID = 'event-1234-5678-9abc-def012345678'

/** Request ID for API Gateway requests */
export const TEST_REQUEST_ID = 'req-1234-5678-9abc-def012345678'

// ============================================================================
// Video IDs (YouTube format - 11 characters)
// ============================================================================

/** Primary test video ID (YouTube format) */
export const TEST_VIDEO_ID = 'YcuKhcqzt7w'

/** Alternative test video ID for multi-video tests */
export const TEST_VIDEO_ID_ALT = 'dQw4w9WgXcQ'

/** Invalid video ID for validation tests */
export const TEST_VIDEO_ID_INVALID = 'invalid'

// ============================================================================
// AWS Account and Region
// ============================================================================

/** Test AWS account ID */
export const TEST_ACCOUNT_ID = '123456789012'

/** Test AWS region */
export const TEST_REGION = 'us-west-2'

/** ARN prefix for SNS resources */
export const TEST_SNS_ARN_PREFIX = `arn:aws:sns:${TEST_REGION}:${TEST_ACCOUNT_ID}`

/** ARN prefix for SQS resources */
export const TEST_SQS_ARN_PREFIX = `arn:aws:sqs:${TEST_REGION}:${TEST_ACCOUNT_ID}`

/** ARN prefix for Lambda resources */
export const TEST_LAMBDA_ARN_PREFIX = `arn:aws:lambda:${TEST_REGION}:${TEST_ACCOUNT_ID}:function`

// ============================================================================
// URLs and Endpoints
// ============================================================================

/** Test CloudFront distribution domain */
export const TEST_CLOUDFRONT_DOMAIN = 'test-cdn.cloudfront.net'

/** Test SQS queue URL format */
export const TEST_SQS_QUEUE_URL = `https://sqs.${TEST_REGION}.amazonaws.com/${TEST_ACCOUNT_ID}/TestQueue`

/** Test S3 bucket name */
export const TEST_BUCKET_NAME = 'test-bucket'

/** Test EventBridge bus name */
export const TEST_EVENT_BUS_NAME = 'MediaDownloader'

// ============================================================================
// GitHub API
// ============================================================================

/** Test GitHub API base URL */
export const TEST_GITHUB_API_BASE = 'https://api.github.com'

/** Test GitHub repository path */
export const TEST_GITHUB_REPO = 'j0nathan-ll0yd/aws-cloudformation-media-downloader'

/** Full GitHub issues API URL */
export const TEST_GITHUB_ISSUES_URL = `${TEST_GITHUB_API_BASE}/repos/${TEST_GITHUB_REPO}/issues`

// ============================================================================
// Error Messages (for consistent error testing)
// ============================================================================

/** Generic network timeout error message */
export const TEST_ERROR_NETWORK_TIMEOUT = 'Network timeout after 30000ms'

/** Database connection error message */
export const TEST_ERROR_DB_CONNECTION = 'Database connection failed'

/** Query timeout error message */
export const TEST_ERROR_QUERY_TIMEOUT = 'Query timeout after 30000ms'

/** User not found error message */
export const TEST_ERROR_USER_NOT_FOUND = 'User not found'

/** Session expired error message */
export const TEST_ERROR_SESSION_EXPIRED = 'Session expired'

// ============================================================================
// Timeout Codes (for error object assignment)
// ============================================================================

/** ETIMEDOUT error code */
export const TEST_ERROR_CODE_TIMEOUT = 'ETIMEDOUT'

/** ECONNREFUSED error code */
export const TEST_ERROR_CODE_CONNECTION = 'ECONNREFUSED'

/** ENOTFOUND error code */
export const TEST_ERROR_CODE_NOT_FOUND = 'ENOTFOUND'
