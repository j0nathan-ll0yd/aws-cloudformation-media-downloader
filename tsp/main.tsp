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
@service
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
 */
@error
model UnauthorizedError {
  /**
   * Error details
   */
  error: {
    /**
     * Error code
     */
    code: "Unauthorized";

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
 * Forbidden error response (403)
 */
@error
model ForbiddenError {
  /**
   * Error details
   */
  error: {
    /**
     * Error code
     */
    code: "Forbidden";

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
 * Internal Server Error response (500)
 */
@error
model InternalServerError {
  /**
   * Error details
   */
  error: {
    /**
     * Error code
     */
    code: "InternalServerError";

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
