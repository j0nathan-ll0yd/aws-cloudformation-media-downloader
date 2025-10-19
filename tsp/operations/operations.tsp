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
   * (sourced from `src/lambdas/ListFiles/test/fixtures/batchGet-200-OK.json`)
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
   * Example request: See `tsp/examples/register-device-request.json`
   * (sourced from `src/lambdas/RegisterDevice/test/fixtures/APIGatewayEvent.json`)
   * 
   * Example response: See `tsp/examples/register-device-response.json`
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
   * Example request: See `tsp/examples/feedly-webhook-request.json`
   * (sourced from `src/lambdas/WebhookFeedly/test/fixtures/handleFeedlyEvent-200-OK.json`)
   * 
   * Example response: See `tsp/examples/feedly-webhook-response.json`
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
   * Example request: See `tsp/examples/user-register-request.json`
   * 
   * Example response: See `tsp/examples/auth-response.json`
   * 
   * @returns JWT access token
   */
  @post
  @route("/register")
  @summary("Register new user")
  registerUser(
    @header("X-API-Key") apiKey: string,
    @body registration: UserRegistration,
  ): {
    @statusCode statusCode: 200;
    @body body: UserRegistrationResponse;
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
   * Example request: See `tsp/examples/user-login-request.json`
   * 
   * Example response: See `tsp/examples/auth-response.json`
   * 
   * @returns JWT access token
   */
  @post
  @route("/login")
  @summary("Login existing user")
  loginUser(
    @header("X-API-Key") apiKey: string,
    @body login: UserLogin,
  ): {
    @statusCode statusCode: 200;
    @body body: UserLoginResponse;
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
}
