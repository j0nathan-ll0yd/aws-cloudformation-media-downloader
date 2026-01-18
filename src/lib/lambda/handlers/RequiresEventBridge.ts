/**
 * EventBridge Permissions Decorator
 *
 * Declarative EventBridge event pattern requirements for Lambda handlers.
 * Used for:
 * - Documentation of event publishing/subscribing in code
 * - Build-time extraction for event flow documentation
 * - MCP validation of declared vs actual event usage
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import type {EventBridgePermissions, WithEventBridgePermissions} from '#types/eventBridgePermissions'

/**
 * Class decorator that declares EventBridge permissions for a Lambda handler.
 * Attaches metadata to the class constructor for build-time extraction.
 *
 * @example
 * ```typescript
 * @RequiresEventBridge({
 *   publishes: ['DownloadRequested', 'DownloadCompleted', 'DownloadFailed'],
 *   subscribes: ['ArticleReceived']
 * })
 * class MyHandler extends SqsHandler { ... }
 * ```
 */
export function RequiresEventBridge(permissions: EventBridgePermissions) {
  return function<T extends new(...args: unknown[]) => unknown>(constructor: T): T {
    const target = constructor as T & WithEventBridgePermissions
    target.__eventBridgePermissions = permissions
    return target
  }
}

/**
 * Retrieve EventBridge permissions from a handler class.
 * Returns undefined if no permissions are declared.
 */
export function getEventBridgePermissions(handlerClass: unknown): EventBridgePermissions | undefined {
  return (handlerClass as WithEventBridgePermissions).__eventBridgePermissions
}
