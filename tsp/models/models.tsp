import "@typespec/http";

using TypeSpec.Http;

namespace OfflineMediaDownloader.Models;

/**
 * Standard API response wrapper for successful responses.
 * All 2xx responses are wrapped in this format.
 */
model ApiResponse<T> {
  /**
   * The actual response data
   */
  body: T;

  /**
   * Unique request identifier for tracing
   */
  requestId: string;
}

/**
 * File status enumeration
 */
enum FileStatus {
  /**
   * File is queued for download
   */
  Queued: "Queued",

  /**
   * File is currently being downloaded
   */
  Downloading: "Downloading",

  /**
   * File has been successfully downloaded
   */
  Downloaded: "Downloaded",

  /**
   * File download failed
   */
  Failed: "Failed",
}

/**
 * A media file available for download
 */
model File {
  /**
   * The unique file identifier (typically a YouTube video ID)
   * @example "4TfEp8oG5gM"
   */
  fileId: string;

  /**
   * The filename or key in S3 storage
   */
  key?: string;

  /**
   * Size in bytes of the file
   */
  size?: int64;

  /**
   * Current status of the file
   */
  status?: FileStatus;

  /**
   * Title of the media file
   */
  title?: string;

  /**
   * Video publish date
   */
  publishDate?: string;

  /**
   * Channel/author display name
   */
  authorName?: string;

  /**
   * Channel/author username or ID
   */
  authorUser?: string;

  /**
   * MIME type (e.g., video/mp4)
   */
  contentType?: string;

  /**
   * Video description
   */
  description?: string;

  /**
   * CloudFront URL for downloading the file
   */
  url?: url;
}

/**
 * Response containing a list of files
 */
model FileListResponse {
  /**
   * Array of available files
   */
  contents: File[];

  /**
   * Number of files returned
   */
  keyCount: int32;
}

/**
 * Device information for push notifications
 */
model Device {
  /**
   * Unique device identifier (UUID)
   * @example "C49BA68B-E21A-4AEE-8D22-D99A2689B56A"
   */
  deviceId: string;

  /**
   * Device name
   * @example "Programmer's iPhone"
   */
  name: string;

  /**
   * Operating system name
   * @example "iOS"
   */
  systemName: string;

  /**
   * Operating system version
   * @example "14.4"
   */
  systemVersion: string;

  /**
   * Device push notification token
   */
  token: string;

  /**
   * AWS SNS endpoint ARN (returned after registration)
   */
  endpointArn?: string;
}

/**
 * Device registration request
 */
model DeviceRegistrationRequest {
  /**
   * Unique device identifier (UUID)
   * @example "C49BA68B-E21A-4AEE-8D22-D99A2689B56A"
   */
  deviceId: string;

  /**
   * Device name
   * @example "Programmer's iPhone"
   */
  name: string;

  /**
   * Operating system name
   * @example "iOS"
   */
  systemName: string;

  /**
   * Operating system version
   * @example "14.4"
   */
  systemVersion: string;

  /**
   * Device push notification token (APNS token)
   */
  token: string;
}

/**
 * Device registration response
 */
model DeviceRegistrationResponse {
  /**
   * AWS SNS endpoint ARN for the registered device
   */
  endpointArn: string;
}

/**
 * Feedly webhook request
 */
model FeedlyWebhookRequest {
  /**
   * URL of the first image in the article
   * @example "https://i.ytimg.com/vi/7jEzw5WLiMI/maxresdefault.jpg"
   */
  articleFirstImageURL?: url;

  /**
   * Categories associated with the article
   * @example "YouTube"
   */
  articleCategories?: string;

  /**
   * Publication date of the article
   * @example "April 27, 2020 at 04:10PM"
   */
  articlePublishedAt?: string;

  /**
   * Title of the article
   */
  articleTitle?: string;

  /**
   * URL of the article (typically a YouTube video URL)
   * @example "https://www.youtube.com/watch?v=wRG7lAGdRII"
   */
  articleURL: url;

  /**
   * Timestamp when the webhook was created
   * @example "April 27, 2020 at 04:10PM"
   */
  createdAt?: string;

  /**
   * URL of the source feed
   * @example "https://www.youtube.com/playlist?list=UUlFSU9_bUb4Rc6OYfTt5SPw"
   */
  sourceFeedURL?: url;

  /**
   * Title of the source
   * @example "Philip DeFranco (uploads) on YouTube"
   */
  sourceTitle?: string;

  /**
   * URL of the source
   * @example "https://youtube.com/playlist?list=UUlFSU9_bUb4Rc6OYfTt5SPw"
   */
  sourceURL?: url;

  /**
   * Whether the webhook was triggered in background mode
   */
  backgroundMode?: boolean;
}

/**
 * Webhook processing response
 */
model WebhookResponse {
  /**
   * Status of the webhook processing
   */
  status: "Dispatched" | "Initiated" | "Accepted";
}

/**
 * User login request
 */
model UserLoginRequest {
  /**
   * Identity token from Sign in with Apple (JWT)
   */
  idToken: string;
}

/**
 * User login response
 */
model UserLoginResponse {
  /**
   * JWT access token for authenticated requests
   */
  token: string;

  /**
   * ISO 8601 timestamp when the session expires
   */
  expiresAt: string;

  /**
   * Session identifier
   */
  sessionId: string;

  /**
   * User identifier
   */
  userId: string;
}

/**
 * User registration request
 */
model UserRegistrationRequest {
  /**
   * Identity token from Sign in with Apple (JWT)
   */
  idToken: string;

  /**
   * User's first name
   */
  firstName?: string;

  /**
   * User's last name
   */
  lastName?: string;
}

/**
 * User registration response
 */
model UserRegistrationResponse {
  /**
   * JWT access token for authenticated requests
   */
  token: string;

  /**
   * ISO 8601 timestamp when the session expires
   */
  expiresAt: string;

  /**
   * Session identifier
   */
  sessionId: string;

  /**
   * User identifier
   */
  userId: string;
}

/**
 * User subscription request
 */
model UserSubscriptionRequest {
  /**
   * AWS SNS endpoint ARN for the device
   */
  endpointArn: string;

  /**
   * AWS SNS topic ARN to subscribe to
   */
  topicArn: string;
}

/**
 * User subscription response
 */
model UserSubscriptionResponse {
  /**
   * AWS SNS subscription ARN
   */
  subscriptionArn: string;
}

/**
 * Token refresh response
 */
model TokenRefreshResponse {
  /**
   * JWT access token (same token, extended expiration)
   */
  token: string;

  /**
   * ISO 8601 timestamp when the session expires
   */
  expiresAt: string;

  /**
   * Session identifier
   */
  sessionId: string;

  /**
   * User identifier
   */
  userId: string;
}

/**
 * Client event request for logging
 */
model ClientEventRequest {
  /**
   * The event message or payload to log
   */
  message: string;
}
