/**
 * Secret Permission Types for Lambda Handlers
 *
 * These types enable explicit declaration of Secrets Manager and Parameter Store
 * dependencies in Lambda handler code via the @RequiresSecrets decorator.
 *
 * The declared permissions are extracted at build time and used to:
 * - Generate IAM policy statements for secretsmanager:GetSecretValue
 * - Generate IAM policy statements for ssm:GetParameter
 * - Validate that declared secrets match actual usage
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */

/**
 * Secret source types for Lambda handlers.
 * Maps to AWS service permissions required.
 */
export enum SecretType {
  /** AWS Secrets Manager secret */
  SecretsManager = 'secretsmanager',
  /** AWS Systems Manager Parameter Store parameter */
  ParameterStore = 'ssm'
}

/**
 * Permission declaration for a single secret or parameter.
 * Specifies the type, name pattern, and optional encryption flag.
 */
export interface SecretPermission {
  /** The secret source type (Secrets Manager or Parameter Store) */
  type: SecretType
  /** The secret/parameter name or ARN pattern (supports wildcards) */
  name: string
  /** For SSM SecureString parameters, indicates if value is encrypted (default: true for SSM) */
  encrypted?: boolean
}

/**
 * Secret permissions declaration for a Lambda handler.
 * An array of secret permissions specifying required access.
 *
 * @example
 * ```typescript
 * import {SecretType} from '#types/secretPermissions'
 *
 * @RequiresSecrets([
 *   {type: SecretType.SecretsManager, name: 'apns/certificate'},
 *   {type: SecretType.ParameterStore, name: '/youtube/cookies', encrypted: true}
 * ])
 * class MyHandler extends ApiHandler { ... }
 * ```
 */
export type SecretPermissions = SecretPermission[]

/**
 * Type augmentation for handler classes with secret permissions metadata.
 * The decorator attaches permissions as a static property.
 */
export interface WithSecretPermissions {
  __secretPermissions?: SecretPermissions
}

/**
 * Constant name for Lambda secret permissions export.
 * Used by the extraction script to find permissions declarations.
 */
export const SECRET_PERMISSIONS_EXPORT_NAME = 'SECRET_PERMISSIONS'
