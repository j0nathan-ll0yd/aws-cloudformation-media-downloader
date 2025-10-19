import "@typespec/http";
import "../main.tsp";
import "../models/models.tsp";

using TypeSpec.Http;
using OfflineMediaDownloader.Models;

namespace OfflineMediaDownloader.Operations;

/**
 * File operations
 */
@route("/files")
@tag("Files")
interface Files {
  /**
   * List all files available to the authenticated user.
   * 
   * Returns files based on authentication status:
   * - Authenticated users: returns their personal file library
   * - Anonymous users: returns a demo file for training purposes
   * - Unauthenticated users: returns 401 Unauthorized
   * 
   * Example response:
   * ```json
   * {
   *   "contents": [
   *     {
   *       "fileId": "PaZ1EmPOE_k",
   *       "key": "20150826-[The School of Life].mp4",
   *       "title": "On Feeling Melancholy",
   *       "status": "Downloaded",
   *       "size": 12023572,
   *       "contentType": "video/mp4",
   *       "authorName": "The School of Life"
   *     }
   *   ],
   *   "keyCount": 1
   * }
   * ```
   * 
   * @returns List of available files
   */
  @get
  @summary("List available files")
  listFiles(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
  ): {
    @statusCode statusCode: 200;
    @body body: FileListResponse;
  } | {
    @statusCode statusCode: 401;
    @body body: UnauthorizedError;
  } | {
    @statusCode statusCode: 403;
    @body body: ForbiddenError;
  } | {
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };
}

/**
 * Device registration operations
 */
@route("/device")
@tag("Devices")
interface Devices {
  /**
   * Register a device to receive push notifications.
   * 
   * This is an idempotent operation that:
   * 1. Creates an AWS SNS endpoint for the device
   * 2. Associates the device with the authenticated user
   * 3. Subscribes the device to push notification topics
   * 
   * Example request:
   * ```json
   * {
   *   "systemVersion": "16.0.2",
   *   "deviceId": "67C431DE-37D2-4BBA-9055-E9D2766517E1",
   *   "name": "iPhone",
   *   "systemName": "iOS",
   *   "token": "1270ac093113154918d1ae96e90247d068b98766842654b3cc2400c7342dc4ba"
   * }
   * ```
   * 
   * Example response:
   * ```json
   * {
   *   "endpointArn": "arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/abcd1234-5678-90ab-cdef-1234567890ab"
   * }
   * ```
   * 
   * @returns Device registration confirmation with endpoint ARN
   */
  @post
  @route("/register")
  @summary("Register device for push notifications")
  registerDevice(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
    @body device: DeviceRegistrationRequest,
  ): {
    @statusCode statusCode: 200;
    @body body: DeviceRegistrationResponse;
  } | {
    @statusCode statusCode: 201;
    @body body: DeviceRegistrationResponse;
  } | {
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
  } | {
    @statusCode statusCode: 401;
    @body body: UnauthorizedError;
  } | {
    @statusCode statusCode: 403;
    @body body: ForbiddenError;
  } | {
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };
}

/**
 * Webhook operations
 */
@route("/feedly")
@tag("Webhooks")
interface Webhooks {
  /**
   * Receive a webhook from Feedly to download media.
   * 
   * When a webhook is received:
   * - If the file exists: associates it with the user and sends push notification
   * - If the file doesn't exist: creates it, associates with user, and queues for download
   * 
   * Background mode can be used to defer immediate download processing.
   * 
   * Example request:
   * ```json
   * {
   *   "articleFirstImageURL": "https://i.ytimg.com/vi/7jEzw5WLiMI/maxresdefault.jpg",
   *   "articleCategories": "YouTube",
   *   "articlePublishedAt": "April 27, 2020 at 04:10PM",
   *   "articleTitle": "WOW! Ariana Grande Meme Backlash & Meme War",
   *   "articleURL": "https://www.youtube.com/watch?v=wRG7lAGdRII",
   *   "createdAt": "April 27, 2020 at 04:10PM",
   *   "sourceFeedURL": "https://www.youtube.com/playlist?list=UUlFSU9_bUb4Rc6OYfTt5SPw",
   *   "sourceTitle": "Philip DeFranco (uploads) on YouTube",
   *   "sourceURL": "https://youtube.com/playlist?list=UUlFSU9_bUb4Rc6OYfTt5SPw"
   * }
   * ```
   * 
   * Example response:
   * ```json
   * {
   *   "status": "Dispatched"
   * }
   * ```
   * 
   * @returns Webhook processing status
   */
  @post
  @summary("Process Feedly webhook")
  processFeedlyWebhook(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
    @body webhook: FeedlyWebhook,
  ): {
    @statusCode statusCode: 200;
    @body body: WebhookResponse;
  } | {
    @statusCode statusCode: 202;
    @body body: WebhookResponse;
  } | {
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
  } | {
    @statusCode statusCode: 403;
    @body body: ForbiddenError;
  } | {
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };
}
