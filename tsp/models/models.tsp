import "@typespec/http";

using TypeSpec.Http;

namespace OfflineMediaDownloader.Models;

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
 * S3 Storage class enumeration
 */
enum StorageClass {
  Standard: "STANDARD",
  ReducedRedundancy: "REDUCED_REDUNDANCY",
  Glacier: "GLACIER",
  StandardIA: "STANDARD_IA",
  OnezoneIA: "ONEZONE_IA",
  IntelligentTiering: "INTELLIGENT_TIERING",
  DeepArchive: "DEEP_ARCHIVE",
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
   * The date the file was last modified
   */
  lastModified?: utcDateTime;

  /**
   * The entity tag is an MD5 hash of the object
   */
  eTag?: string;

  /**
   * Size in bytes of the file
   */
  size?: int64;

  /**
   * S3 storage class
   */
  storageClass?: StorageClass;

  /**
   * Current status of the file
   */
  status?: FileStatus;

  /**
   * Title of the media file
   */
  title?: string;

  /**
   * Thumbnail URL for the media
   */
  thumbnail?: url;

  /**
   * Duration of the media in seconds
   */
  duration?: int32;
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
 * Feedly webhook event
 */
model FeedlyWebhook {
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
  articleTitle: string;

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
model UserLogin {
  /**
   * Authorization code from Sign in with Apple
   */
  authorizationCode: string;
}

/**
 * User login response
 */
model UserLoginResponse {
  /**
   * JWT access token for authenticated requests
   */
  token: string;
}

/**
 * User registration request
 */
model UserRegistration {
  /**
   * Authorization code from Sign in with Apple
   */
  authorizationCode: string;

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
}
