/**
 * Environment Configuration Fixtures
 *
 * Test fixtures for validating staging/production environment configurations.
 * Used to test environment-specific behavior in Lambda functions and
 * integration tests.
 *
 * @example
 * ```typescript
 * import {STAGING_CONFIG, PRODUCTION_CONFIG, getEnvironmentConfig} from '#test/helpers/environment-fixtures'
 *
 * // Test staging-specific behavior
 * vi.stubEnv('ENVIRONMENT', STAGING_CONFIG.environment)
 * vi.stubEnv('LOG_LEVEL', STAGING_CONFIG.logLevel)
 *
 * // Get config by environment name
 * const config = getEnvironmentConfig('staging')
 * ```
 */

// ============================================================================
// Environment Types
// ============================================================================

export type EnvironmentName = 'staging' | 'production'

export interface EnvironmentConfig {
  /** Environment name (staging, production) */
  environment: EnvironmentName
  /** Resource prefix for AWS resources (stag, prod) */
  resourcePrefix: string
  /** Log level for Lambda functions */
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  /** CloudWatch log retention in days */
  logRetentionDays: number
  /** API Gateway throttle burst limit */
  apiThrottleBurstLimit: number
  /** API Gateway throttle rate limit */
  apiThrottleRateLimit: number
  /** Whether DSQL deletion protection is enabled */
  dsqlDeletionProtection: boolean
  /** Whether CloudWatch dashboard is enabled */
  enableCloudwatchDashboard: boolean
  /** Whether CloudWatch alarms are enabled */
  enableCloudwatchAlarms: boolean
  /** Reserved concurrency for download Lambda (0 = unreserved) */
  downloadReservedConcurrency: number
}

// ============================================================================
// Staging Configuration
// ============================================================================

/**
 * Staging environment configuration.
 * Matches terraform/environments/staging.tfvars
 */
export const STAGING_CONFIG: EnvironmentConfig = {
  environment: 'staging',
  resourcePrefix: 'stag',
  logLevel: 'DEBUG',
  logRetentionDays: 3,
  apiThrottleBurstLimit: 20,
  apiThrottleRateLimit: 10,
  dsqlDeletionProtection: false,
  enableCloudwatchDashboard: false,
  enableCloudwatchAlarms: false,
  downloadReservedConcurrency: 0
}

// ============================================================================
// Production Configuration
// ============================================================================

/**
 * Production environment configuration.
 * Matches terraform/environments/production.tfvars
 */
export const PRODUCTION_CONFIG: EnvironmentConfig = {
  environment: 'production',
  resourcePrefix: 'prod',
  logLevel: 'INFO',
  logRetentionDays: 7,
  apiThrottleBurstLimit: 100,
  apiThrottleRateLimit: 50,
  dsqlDeletionProtection: true,
  enableCloudwatchDashboard: false,
  enableCloudwatchAlarms: true,
  downloadReservedConcurrency: 1
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get environment configuration by name.
 *
 * @param environment - Environment name
 * @returns Environment configuration
 * @throws Error if environment is invalid
 */
export function getEnvironmentConfig(environment: EnvironmentName): EnvironmentConfig {
  switch (environment) {
    case 'staging':
      return STAGING_CONFIG
    case 'production':
      return PRODUCTION_CONFIG
    default:
      throw new Error(`Invalid environment: ${environment}`)
  }
}

/**
 * Get the resource name with environment prefix.
 *
 * @param baseName - Base resource name (e.g., 'RegisterUser')
 * @param environment - Environment name
 * @returns Prefixed resource name (e.g., 'stag-RegisterUser')
 */
export function getPrefixedResourceName(baseName: string, environment: EnvironmentName): string {
  const config = getEnvironmentConfig(environment)
  return `${config.resourcePrefix}-${baseName}`
}

/**
 * Get environment variables for Lambda test setup.
 *
 * @param environment - Environment name
 * @returns Object with environment variables to stub
 */
export function getTestEnvironmentVariables(environment: EnvironmentName): Record<string, string> {
  const config = getEnvironmentConfig(environment)
  return {ENVIRONMENT: config.environment, LOG_LEVEL: config.logLevel, RESOURCE_PREFIX: config.resourcePrefix}
}

// ============================================================================
// Environment-Specific Resource Names
// ============================================================================

/**
 * Get Lambda function names for an environment.
 */
export function getLambdaFunctionNames(environment: EnvironmentName): string[] {
  const prefix = getEnvironmentConfig(environment).resourcePrefix
  return [
    `${prefix}-ApiGatewayAuthorizer`,
    `${prefix}-CleanupExpiredRecords`,
    `${prefix}-CloudfrontMiddleware`,
    `${prefix}-DeviceEvent`,
    `${prefix}-ListFiles`,
    `${prefix}-LoginUser`,
    `${prefix}-LogoutUser`,
    `${prefix}-MigrateDSQL`,
    `${prefix}-PruneDevices`,
    `${prefix}-RefreshToken`,
    `${prefix}-RegisterDevice`,
    `${prefix}-RegisterUser`,
    `${prefix}-S3ObjectCreated`,
    `${prefix}-SendPushNotification`,
    `${prefix}-StartFileUpload`,
    `${prefix}-UserDelete`,
    `${prefix}-UserSubscribe`,
    `${prefix}-WebhookFeedly`
  ]
}

/**
 * Get S3 bucket name for an environment.
 */
export function getS3BucketName(environment: EnvironmentName, accountId: string): string {
  const prefix = getEnvironmentConfig(environment).resourcePrefix
  return `lifegames-${prefix}-media-files-${accountId}`
}

/**
 * Get DynamoDB table name for an environment.
 */
export function getDynamoDBTableName(environment: EnvironmentName): string {
  const prefix = getEnvironmentConfig(environment).resourcePrefix
  return `${prefix}-MediaDownloader-Idempotency`
}

/**
 * Get EventBridge bus name for an environment.
 */
export function getEventBridgeBusName(environment: EnvironmentName): string {
  const prefix = getEnvironmentConfig(environment).resourcePrefix
  return `${prefix}-MediaDownloader`
}

/**
 * Get SQS queue name for an environment.
 */
export function getSQSQueueName(queueBaseName: string, environment: EnvironmentName): string {
  const prefix = getEnvironmentConfig(environment).resourcePrefix
  return `${prefix}-${queueBaseName}`
}
