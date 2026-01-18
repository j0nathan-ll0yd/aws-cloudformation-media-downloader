/**
 * EventBridge Permission Types for Lambda Handlers
 *
 * These types enable explicit declaration of EventBridge event patterns
 * in Lambda handler code via the @RequiresEventBridge decorator.
 *
 * The declared permissions are extracted at build time and used to:
 * - Document event flow in code
 * - Generate event flow documentation
 * - Validate that declared events match actual publishEvent() calls
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */

/**
 * EventBridge permissions declaration for a Lambda handler.
 * Specifies which event types the Lambda publishes or subscribes to.
 *
 * @example
 * ```typescript
 * @RequiresEventBridge({
 *   publishes: ['DownloadRequested', 'DownloadCompleted', 'DownloadFailed'],
 *   subscribes: ['ArticleReceived']
 * })
 * class MyHandler extends ApiHandler { ... }
 * ```
 */
export interface EventBridgePermissions {
  /** Event detail-types this Lambda publishes */
  publishes?: string[]
  /** Event detail-types this Lambda subscribes to */
  subscribes?: string[]
  /** Custom event bus name (defaults to 'default') */
  eventBus?: string
}

/**
 * Type augmentation for handler classes with EventBridge permissions metadata.
 * The decorator attaches permissions as a static property.
 */
export interface WithEventBridgePermissions {
  __eventBridgePermissions?: EventBridgePermissions
}

/**
 * Constant name for Lambda EventBridge permissions export.
 * Used by the extraction script to find permissions declarations.
 */
export const EVENTBRIDGE_PERMISSIONS_EXPORT_NAME = 'EVENTBRIDGE_PERMISSIONS'
