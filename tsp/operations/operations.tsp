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
   * Query parameters:
   * - status=all: Returns files in all statuses (Queued, Downloading, Downloaded, Failed)
   * - status=downloaded (default): Returns only downloaded files
   *
   * Example response: See `tsp/examples/list-files-response.json`
   */
  @get
  @summary("List available files")
  listFiles(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
    @query status?: "all" | "downloaded",
  ): {
    @doc("List of available files")
    @statusCode statusCode: 200;
    @body body: ApiResponse<FileListResponse>;
  } | {
    @doc("Authentication failed - invalid or missing session token")
    @statusCode statusCode: 401;
    @body body: UnauthorizedError;
  } | {
    @doc("Access denied - invalid API key")
    @statusCode statusCode: 403;
    @body body: ForbiddenError;
  } | {
    @doc("Internal server error")
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
   * Example request: See `tsp/examples/register-device-request.json`
   *
   * Example response: See `tsp/examples/register-device-response.json`
   */
  @post
  @route("/register")
  @summary("Register device for push notifications")
  registerDevice(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
    @body device: DeviceRegistrationRequest,
  ): {
    @doc("Device updated with new push token")
    @statusCode statusCode: 200;
    @body body: ApiResponse<DeviceRegistrationResponse>;
  } | {
    @doc("Device registered for the first time")
    @statusCode statusCode: 201;
    @body body: ApiResponse<DeviceRegistrationResponse>;
  } | {
    @doc("Invalid request - missing or malformed fields")
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
  } | {
    @doc("Authentication failed - invalid or missing session token")
    @statusCode statusCode: 401;
    @body body: UnauthorizedError;
  } | {
    @doc("Access denied - invalid API key")
    @statusCode statusCode: 403;
    @body body: ForbiddenError;
  } | {
    @doc("Internal server error")
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };

  /**
   * Log a client-side event for debugging and analytics.
   *
   * Receives event data from the iOS client and logs it to CloudWatch
   * for later analysis. Used for debugging and usage analytics.
   */
  @post
  @route("/event")
  @summary("Log client event")
  logClientEvent(
    @header("X-API-Key") apiKey: string,
    @header("X-Device-UUID") deviceId?: string,
    @body event: ClientEventRequest,
  ): {
    @doc("Event logged successfully")
    @statusCode statusCode: 204;
  } | {
    @doc("Invalid request - missing or malformed fields")
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
  } | {
    @doc("Internal server error")
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
   * Example request: See `tsp/examples/webhook-feedly-request.json`
   *
   * Example response: See `tsp/examples/webhook-feedly-response.json`
   */
  @post
  @summary("Process Feedly webhook")
  processFeedlyWebhook(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
    @body webhook: FeedlyWebhookRequest,
  ): {
    @doc("File already downloaded and notification sent")
    @statusCode statusCode: 200;
    @body body: ApiResponse<WebhookResponse>;
  } | {
    @doc("File queued for download")
    @statusCode statusCode: 202;
    @body body: ApiResponse<WebhookResponse>;
  } | {
    @doc("Invalid request - missing or invalid URL")
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
  } | {
    @doc("Access denied - invalid API key")
    @statusCode statusCode: 403;
    @body body: ForbiddenError;
  } | {
    @doc("Internal server error")
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };
}

/**
 * User authentication operations
 */
@route("/user")
@tag("Authentication")
interface Authentication {
  /**
   * Register a new user with Sign in with Apple.
   *
   * Creates a new user account or returns existing user token.
   * All user details are sourced from the Apple identity token.
   *
   * Example request: See `tsp/examples/register-user-request.json`
   *
   * Example response: See `tsp/examples/register-user-response.json`
   */
  @post
  @route("/register")
  @summary("Register new user")
  registerUser(
    @header("X-API-Key") apiKey: string,
    @body registration: UserRegistrationRequest,
  ): {
    @doc("User registered successfully with JWT access token")
    @statusCode statusCode: 200;
    @body body: ApiResponse<UserRegistrationResponse>;
  } | {
    @doc("Invalid request - missing or malformed fields")
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
  } | {
    @doc("Access denied - invalid API key")
    @statusCode statusCode: 403;
    @body body: ForbiddenError;
  } | {
    @doc("Internal server error")
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };

  /**
   * Login an existing user with Sign in with Apple.
   *
   * Authenticates a user and returns a JWT access token.
   *
   * Example request: See `tsp/examples/login-user-request.json`
   *
   * Example response: See `tsp/examples/login-user-response.json`
   */
  @post
  @route("/login")
  @summary("Login existing user")
  loginUser(
    @header("X-API-Key") apiKey: string,
    @body login: UserLoginRequest,
  ): {
    @doc("Login successful with JWT access token")
    @statusCode statusCode: 200;
    @body body: ApiResponse<UserLoginResponse>;
  } | {
    @doc("Invalid request - missing or malformed fields")
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
  } | {
    @doc("User not found - needs registration first")
    @statusCode statusCode: 404;
    @body body: ErrorResponse;
  } | {
    @doc("Access denied - invalid API key")
    @statusCode statusCode: 403;
    @body body: ForbiddenError;
  } | {
    @doc("Conflict - user already exists with different provider")
    @statusCode statusCode: 409;
    @body body: ErrorResponse;
  } | {
    @doc("Internal server error")
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };

  /**
   * Refresh an existing session token.
   *
   * Extends the session expiration time without re-authenticating.
   * The same token is returned with an updated expiration time.
   */
  @post
  @route("/refresh")
  @summary("Refresh session token")
  refreshToken(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
  ): {
    @doc("Session refreshed with extended expiration")
    @statusCode statusCode: 200;
    @body body: ApiResponse<TokenRefreshResponse>;
  } | {
    @doc("Authentication failed - invalid or expired session token")
    @statusCode statusCode: 401;
    @body body: UnauthorizedError;
  } | {
    @doc("Internal server error")
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };

  /**
   * Delete user account and all associated data.
   *
   * Required for Sign in with Apple compliance (account deletion requirement).
   * Deletes user files, devices, and the user record itself.
   */
  @delete
  @summary("Delete user account")
  deleteUser(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
  ): {
    @doc("User deleted successfully")
    @statusCode statusCode: 204;
  } | {
    @doc("Partial deletion - some resources could not be removed")
    @statusCode statusCode: 207;
    @body body: ErrorResponse;
  } | {
    @doc("Authentication failed - invalid or missing session token")
    @statusCode statusCode: 401;
    @body body: UnauthorizedError;
  } | {
    @doc("Internal server error")
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };

  /**
   * Subscribe a user's device to push notification topics.
   *
   * Links an SNS endpoint (device) to an SNS topic for receiving notifications.
   */
  @post
  @route("/subscribe")
  @summary("Subscribe to notifications")
  subscribeUser(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
    @body subscription: UserSubscriptionRequest,
  ): {
    @doc("Subscription created successfully")
    @statusCode statusCode: 201;
    @body body: ApiResponse<UserSubscriptionResponse>;
  } | {
    @doc("Invalid request - missing or malformed fields")
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
  } | {
    @doc("Authentication failed - invalid or missing session token")
    @statusCode statusCode: 401;
    @body body: UnauthorizedError;
  } | {
    @doc("Internal server error")
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };
}
