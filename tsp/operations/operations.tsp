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
   * Example response: See `tsp/examples/list-files-response.json`
   * (sourced from `src/lambdas/ListFiles/test/fixtures/apiResponse-GET-200-OK.json`)
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
    @body body: ApiResponse<FileListResponse>;
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
   * Example request: See `tsp/examples/register-device-request.json`
   * (sourced from `src/lambdas/RegisterDevice/test/fixtures/apiRequest-POST-device.json`)
   *
   * Example response: See `tsp/examples/register-device-response.json`
   * (sourced from `src/lambdas/RegisterDevice/test/fixtures/apiResponse-POST-200-OK.json`)
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
    @body body: ApiResponse<DeviceRegistrationResponse>;
  } | {
    @statusCode statusCode: 201;
    @body body: ApiResponse<DeviceRegistrationResponse>;
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

  /**
   * Log a client-side event for debugging and analytics.
   *
   * Receives event data from the iOS client and logs it to CloudWatch
   * for later analysis. Used for debugging and usage analytics.
   *
   * @returns No content on success
   */
  @post
  @route("/event")
  @summary("Log client event")
  logClientEvent(
    @header("X-API-Key") apiKey: string,
    @header("X-Device-UUID") deviceId?: string,
    @body event: ClientEventRequest,
  ): {
    @statusCode statusCode: 204;
  } | {
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
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
   * Example request: See `tsp/examples/webhook-feedly-request.json`
   * (sourced from `src/lambdas/WebhookFeedly/test/fixtures/apiRequest-POST-webhook.json`)
   * 
   * Example response: See `tsp/examples/webhook-feedly-response.json`
   * (sourced from `src/lambdas/WebhookFeedly/test/fixtures/apiResponse-POST-200-OK.json`)
   * 
   * @returns Webhook processing status
   */
  @post
  @summary("Process Feedly webhook")
  processFeedlyWebhook(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
    @body webhook: FeedlyWebhookRequest,
  ): {
    @statusCode statusCode: 200;
    @body body: ApiResponse<WebhookResponse>;
  } | {
    @statusCode statusCode: 202;
    @body body: ApiResponse<WebhookResponse>;
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
   * (sourced from `src/lambdas/RegisterUser/test/fixtures/apiRequest-POST-register.json`)
   * 
   * Example response: See `tsp/examples/register-user-response.json`
   * (sourced from `src/lambdas/RegisterUser/test/fixtures/apiResponse-POST-200-OK.json`)
   * 
   * @returns JWT access token
   */
  @post
  @route("/register")
  @summary("Register new user")
  registerUser(
    @header("X-API-Key") apiKey: string,
    @body registration: UserRegistrationRequest,
  ): {
    @statusCode statusCode: 200;
    @body body: ApiResponse<UserRegistrationResponse>;
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

  /**
   * Login an existing user with Sign in with Apple.
   *
   * Authenticates a user and returns a JWT access token.
   *
   * Example request: See `tsp/examples/login-user-request.json`
   * (sourced from `src/lambdas/LoginUser/test/fixtures/apiRequest-POST-login.json`)
   *
   * Example response: See `tsp/examples/login-user-response.json`
   * (sourced from `src/lambdas/LoginUser/test/fixtures/apiResponse-POST-200-OK.json`)
   *
   * @returns JWT access token
   */
  @post
  @route("/login")
  @summary("Login existing user")
  loginUser(
    @header("X-API-Key") apiKey: string,
    @body login: UserLoginRequest,
  ): {
    @statusCode statusCode: 200;
    @body body: ApiResponse<UserLoginResponse>;
  } | {
    @statusCode statusCode: 409;
    @body body: ErrorResponse;
  } | {
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
  } | {
    @statusCode statusCode: 404;
    @body body: ErrorResponse;
  } | {
    @statusCode statusCode: 403;
    @body body: ForbiddenError;
  } | {
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };

  /**
   * Refresh an existing session token.
   *
   * Extends the session expiration time without re-authenticating.
   * The same token is returned with an updated expiration time.
   *
   * @returns Refreshed session information
   */
  @post
  @route("/refresh")
  @summary("Refresh session token")
  refreshToken(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
  ): {
    @statusCode statusCode: 200;
    @body body: ApiResponse<TokenRefreshResponse>;
  } | {
    @statusCode statusCode: 401;
    @body body: UnauthorizedError;
  } | {
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };

  /**
   * Delete user account and all associated data.
   *
   * Required for Sign in with Apple compliance (account deletion requirement).
   * Deletes user files, devices, and the user record itself.
   *
   * @returns No content on success
   */
  @delete
  @summary("Delete user account")
  deleteUser(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
  ): {
    @statusCode statusCode: 204;
  } | {
    @statusCode statusCode: 207;
    @body body: ErrorResponse;
  } | {
    @statusCode statusCode: 401;
    @body body: UnauthorizedError;
  } | {
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };

  /**
   * Subscribe a user's device to push notification topics.
   *
   * Links an SNS endpoint (device) to an SNS topic for receiving notifications.
   *
   * @returns Subscription ARN
   */
  @post
  @route("/subscribe")
  @summary("Subscribe to notifications")
  subscribeUser(
    @header("Authorization") authorization: string,
    @header("X-API-Key") apiKey: string,
    @body subscription: UserSubscriptionRequest,
  ): {
    @statusCode statusCode: 201;
    @body body: ApiResponse<UserSubscriptionResponse>;
  } | {
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
  } | {
    @statusCode statusCode: 401;
    @body body: UnauthorizedError;
  } | {
    @statusCode statusCode: 500;
    @body body: InternalServerError;
  };
}

