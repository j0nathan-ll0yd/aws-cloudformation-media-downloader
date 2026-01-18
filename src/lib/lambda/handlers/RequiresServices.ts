/**
 * Service Permissions Decorator
 *
 * Declarative AWS service access requirements for Lambda handlers.
 * Used for:
 * - Documentation of service dependencies in code
 * - Build-time extraction for IAM policy generation
 * - MCP validation of declared vs actual usage
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import type {ServicePermissions, WithServicePermissions} from '#types/servicePermissions'

/**
 * Class decorator that declares AWS service permissions for a Lambda handler.
 * Attaches metadata to the class constructor for build-time extraction.
 *
 * @example
 * ```typescript
 * @RequiresServices([
 *   {service: AWSService.S3, resource: 'media-bucket/*', operations: [S3Operation.GetObject, S3Operation.PutObject]},
 *   {service: AWSService.SQS, resource: 'download-queue', operations: [SQSOperation.SendMessage]}
 * ])
 * class MyHandler extends SqsHandler { ... }
 * ```
 */
export function RequiresServices(permissions: ServicePermissions) {
  return function<T extends new(...args: unknown[]) => unknown>(constructor: T): T {
    const target = constructor as T & WithServicePermissions
    target.__servicePermissions = permissions
    return target
  }
}

/**
 * Retrieve service permissions from a handler class.
 * Returns undefined if no permissions are declared.
 */
export function getServicePermissions(handlerClass: unknown): ServicePermissions | undefined {
  return (handlerClass as WithServicePermissions).__servicePermissions
}
