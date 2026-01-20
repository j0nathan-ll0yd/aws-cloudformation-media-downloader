/**
 * Secret Permissions Decorator
 *
 * Declarative secret access requirements for Lambda handlers.
 * Used for:
 * - Documentation of secret dependencies in code
 * - Build-time extraction for IAM policy generation
 * - MCP validation of declared vs actual usage
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import type {SecretPermissions, WithSecretPermissions} from '#types/secretPermissions'

/**
 * Class decorator that declares secret permissions for a Lambda handler.
 * Attaches metadata to the class constructor for build-time extraction.
 *
 * @example
 * ```typescript
 * @RequiresSecrets([
 *   {type: SecretType.SecretsManager, name: 'apns/certificate'},
 *   {type: SecretType.ParameterStore, name: '/youtube/cookies', encrypted: true}
 * ])
 * class MyHandler extends SqsHandler { ... }
 * ```
 */
export function RequiresSecrets(permissions: SecretPermissions) {
  return function<T extends new(...args: unknown[]) => unknown>(constructor: T): T {
    const target = constructor as T & WithSecretPermissions
    target.__secretPermissions = permissions
    return target
  }
}

/**
 * Retrieve secret permissions from a handler class.
 * Returns undefined if no permissions are declared.
 */
export function getSecretPermissions(handlerClass: unknown): SecretPermissions | undefined {
  return (handlerClass as WithSecretPermissions).__secretPermissions
}
