import "@typespec/http";
import "@typespec/openapi3";
import "./models/models.tsp";
import "./operations/operations.tsp";

using TypeSpec.Http;

/**
 * Offline Media Downloader API
 * 
 * A serverless AWS media downloader service that downloads media content
 * (primarily YouTube videos) and integrates with a companion iOS app for
 * offline playback.
 */
@service(#{
  title: "Offline Media Downloader API",
})
@server("https://api.example.com", "Production server")
namespace OfflineMediaDownloader;

/**
 * Common error response structure
 */
@error
model ErrorResponse {
  /**
   * Error details
   */
  error: {
    /**
     * Error code
     */
    code: string;

    /**
     * Error message
     */
    message: string;
  };

  /**
   * Request ID for tracking
   */
  requestId: string;
}

/**
 * Unauthorized error response (401)
 *
 * Returned when authentication fails. The iOS app MUST handle this by:
 * 1. Clearing stored session tokens
 * 2. Prompting user to re-authenticate via Sign in with Apple
 *
 * Common causes:
 * - Session token is invalid or malformed
 * - Session token has expired (sessions expire after 30 days of inactivity)
 * - Authorization header is missing on a protected endpoint
 * - Bearer token format is invalid
 *
 * Note: This is distinct from 403 Forbidden, which indicates the API key
 * is invalid (not the session token).
 */
@error
model UnauthorizedError {
  /**
   * Error details
   */
  error: {
    /**
     * Error code - typically "Unauthorized" for 401 responses, but may vary
     * based on API Gateway configuration (e.g., "custom-4XX-generic")
     */
    code: string;

    /**
     * Human-readable error message describing the authentication failure.
     * Examples: "Invalid session token", "Session expired", "Authorization header missing"
     */
    message: string;
  };

  /**
   * Request ID for tracking and debugging
   */
  requestId: string;
}

/**
 * Forbidden error response (403)
 *
 * Returned when the API key is invalid or the request is not authorized.
 * This is NOT related to session tokens - see UnauthorizedError (401) for session issues.
 *
 * Common causes:
 * - API key is missing from query parameters
 * - API key is invalid or disabled
 * - Request is not allowed for this API key
 */
@error
model ForbiddenError {
  /**
   * Error details
   */
  error: {
    /**
     * Error code - typically "Forbidden" for 403 responses, but may vary
     * based on API Gateway configuration
     */
    code: string;

    /**
     * Human-readable error message describing the authorization failure
     */
    message: string;
  };

  /**
   * Request ID for tracking and debugging
   */
  requestId: string;
}

/**
 * Internal Server Error response (500)
 */
@error
model InternalServerError {
  /**
   * Error details
   */
  error: {
    /**
     * Error code - typically "InternalServerError" for 500 responses
     */
    code: string;

    /**
     * Error message
     */
    message: string;
  };

  /**
   * Request ID for tracking
   */
  requestId: string;
}
