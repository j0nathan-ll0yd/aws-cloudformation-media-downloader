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

/** Test SQS push notification queue URL */
export const TEST_SQS_PUSH_NOTIFICATION_URL = `https://sqs.${TEST_REGION}.amazonaws.com/${TEST_ACCOUNT_ID}/SendPushNotification`

/** Test S3 bucket name */
export const TEST_BUCKET_NAME = 'test-bucket'

/** Test S3 sandbox bucket name */
export const TEST_BUCKET_NAME_SANDBOX = 'lifegames-sandbox-testbucket'

/** Test EventBridge bus name */
export const TEST_EVENT_BUS_NAME = 'MediaDownloader'

/** Test thumbnail URL */
export const TEST_THUMBNAIL_URL = 'https://example.com/thumbnail.jpg'

/** Test YouTube thumbnail URL (specific format) */
export const TEST_YOUTUBE_THUMBNAIL_URL = 'https://i.ytimg.com/vi/7jEzw5WLiMI/maxresdefault.jpg'

// ============================================================================
// SNS ARNs (Push Notifications)
// ============================================================================

/** Test SNS platform application ARN */
export const TEST_PLATFORM_APPLICATION_ARN = `arn:aws:sns:${TEST_REGION}:${TEST_ACCOUNT_ID}:app/APNS_SANDBOX/MediaDownloader`

/** Test SNS endpoint ARN (for device registration) */
export const TEST_SNS_ENDPOINT_ARN = `${TEST_SNS_ARN_PREFIX}:endpoint/APNS_SANDBOX/MediaDownloader/test-endpoint`

/** Test SNS push notification topic ARN */
export const TEST_SNS_TOPIC_ARN = `${TEST_SNS_ARN_PREFIX}:PushNotifications`

// ============================================================================
// S3 Object Keys (Media Files)
// ============================================================================

/** Test S3 object key with special characters (brackets) */
export const TEST_S3_KEY_WITH_BRACKETS = '20210122-[Philip DeFranco].mp4'

/** Test S3 object key (URL-encoded brackets) */
export const TEST_S3_KEY_URL_ENCODED = '20191209-%5Bsxephil%5D.mp4'

/** Test S3 object key (decoded) */
export const TEST_S3_KEY_DECODED = '20191209-[sxephil].mp4'

/** Test S3 URL result from upload */
export const TEST_S3_URL = `s3://${TEST_BUCKET_NAME}/test-video.mp4`

// ============================================================================
// YouTube/Video URLs
// ============================================================================

/** Test YouTube video URL */
export const TEST_YOUTUBE_URL = 'https://www.youtube.com/watch?v=wRG7lAGdRII'

/** Test YouTube playlist URL */
export const TEST_YOUTUBE_PLAYLIST_URL = 'https://www.youtube.com/playlist?list=UUlFSU9_bUb4Rc6OYfTt5SPw'

/** Test YouTube channel uploads URL */
export const TEST_YOUTUBE_CHANNEL_URL = 'https://youtube.com/playlist?list=UUlFSU9_bUb4Rc6OYfTt5SPw'

// ============================================================================
// Feedly Webhook Data
// ============================================================================

/** Test Feedly article title */
export const TEST_FEEDLY_ARTICLE_TITLE = 'WOW! Ariana Grande Meme Backlash & Meme War, COVID-19 Contact Tracing Problems, Mr. Beast & More'

/** Test Feedly source title */
export const TEST_FEEDLY_SOURCE_TITLE = 'Philip DeFranco (uploads) on YouTube'

/** Test Feedly category */
export const TEST_FEEDLY_CATEGORY = 'YouTube'

/** Test Feedly published date */
export const TEST_FEEDLY_PUBLISHED_AT = 'April 27, 2020 at 04:10PM'

// ============================================================================
// Video Metadata
// ============================================================================

/** Test video title */
export const TEST_VIDEO_TITLE = 'Test Video'

/** Test video uploader/author name */
export const TEST_VIDEO_UPLOADER = 'Test Uploader'

/** Test video description */
export const TEST_VIDEO_DESCRIPTION = 'Test description'

/** Test video upload date (YouTube format: YYYYMMDD) */
export const TEST_VIDEO_UPLOAD_DATE = '20231201'

/** Test video duration in seconds */
export const TEST_VIDEO_DURATION = 300

/** Test video file size in bytes (~79MB) */
export const TEST_VIDEO_FILE_SIZE = 82784319

/** Test large video file size in bytes (100MB) */
export const TEST_VIDEO_FILE_SIZE_LARGE = 104857600

// ============================================================================
// DynamoDB/Database
// ============================================================================

/** Test DynamoDB table name */
export const TEST_DYNAMODB_TABLE_NAME = 'test-table'

/** Test idempotency table name */
export const TEST_IDEMPOTENCY_TABLE_NAME = 'IdempotencyTable'

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
