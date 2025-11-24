# Lambda Environment Variables

## Quick Reference
- **When to use**: Configuring Lambda functions with runtime parameters
- **Enforcement**: Required - consistent naming and usage
- **Impact if violated**: MEDIUM - Configuration confusion, debugging difficulty

## Overview

Lambda environment variables should follow consistent naming conventions and usage patterns. Use SCREAMING_SNAKE_CASE for environment variables and provide sensible defaults where appropriate.

## The Rules

### 1. Use SCREAMING_SNAKE_CASE

All environment variable names use uppercase with underscores.

### 2. Prefix Project-Specific Variables

Use consistent prefixes to group related configuration.

### 3. Provide Defaults for Non-Secrets

Non-sensitive configuration should have fallback defaults.

### 4. Never Hard-Code Secrets

Secrets must come from environment variables, never hard-coded.

## Examples

### ✅ Correct - Environment Variable Usage

```typescript
// src/lambdas/DownloadVideo/src/index.ts

// ✅ SCREAMING_SNAKE_CASE with sensible defaults
const region = process.env.AWS_REGION || 'us-west-2'
const tableName = process.env.TABLE_NAME || 'MediaDownloader'
const bucketName = process.env.BUCKET_NAME!  // Required, no default

// ✅ Feature flags with boolean conversion
const enableXRay = process.env.ENABLE_XRAY === 'true'
const dryRun = process.env.DRY_RUN === 'true'

// ✅ Numeric values with parsing and defaults
const maxRetries = parseInt(process.env.MAX_RETRIES || '3', 10)
const timeoutMs = parseInt(process.env.TIMEOUT_MS || '300000', 10)

// ✅ Required secrets (no defaults)
const apiToken = process.env.API_TOKEN
if (!apiToken) {
  throw new Error('API_TOKEN environment variable is required')
}
```

### ✅ Correct - OpenTofu Configuration

```hcl
# terraform/LambdaDownloadVideo.tf

resource "aws_lambda_function" "download_video" {
  function_name = "DownloadVideo"
  
  environment {
    variables = {
      # AWS configuration
      AWS_REGION     = var.aws_region
      
      # Service resources
      TABLE_NAME     = aws_dynamodb_table.media_downloader.name
      BUCKET_NAME    = aws_s3_bucket.media_files.id
      
      # Feature flags
      ENABLE_XRAY    = "true"
      DRY_RUN        = "false"
      
      # Operational settings
      MAX_RETRIES    = "3"
      TIMEOUT_MS     = "300000"
      
      # Secrets (from AWS Secrets Manager or Parameter Store)
      API_TOKEN      = data.aws_secretsmanager_secret_version.api_token.secret_string
    }
  }
}
```

### ✅ Correct - Environment-Specific Configuration

```typescript
// lib/vendor/AWS/S3.ts

// ✅ Support LocalStack for testing
const s3Config = {
  region: process.env.AWS_REGION || 'us-west-2',
  endpoint: process.env.S3_ENDPOINT,  // Set for LocalStack
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'  // Required for LocalStack
}

// ✅ Use transfer acceleration conditionally
const bucketConfig = {
  bucket: process.env.BUCKET_NAME!,
  useAccelerateEndpoint: process.env.S3_ACCELERATE === 'true'
}
```

### ❌ Incorrect - Poor Naming

```typescript
// ❌ WRONG - Inconsistent casing
const region = process.env.region  // Should be AWS_REGION
const table = process.env.tableName  // Should be TABLE_NAME
const bucket = process.env.BucketName  // Should be BUCKET_NAME

// ❌ WRONG - No prefix for project variables
const token = process.env.TOKEN  // Too generic, conflicts possible
const url = process.env.URL  // What URL? Be specific

// ✅ CORRECT - Descriptive names
const apiToken = process.env.API_TOKEN
const feedlyWebhookUrl = process.env.FEEDLY_WEBHOOK_URL
```

### ❌ Incorrect - Hard-Coded Values

```typescript
// ❌ WRONG - Hard-coded configuration
const tableName = 'MediaDownloader'
const bucketName = 'my-media-files'
const apiToken = 'sk-1234567890abcdef'  // NEVER!

// ✅ CORRECT - From environment
const tableName = process.env.TABLE_NAME!
const bucketName = process.env.BUCKET_NAME!
const apiToken = process.env.API_TOKEN!
```

### ❌ Incorrect - Missing Validation

```typescript
// ❌ WRONG - No validation for required variables
const apiToken = process.env.API_TOKEN  // Might be undefined
await callApi(apiToken)  // Runtime error if undefined

// ✅ CORRECT - Validate required variables
const apiToken = process.env.API_TOKEN
if (!apiToken) {
  throw new Error('API_TOKEN environment variable is required')
}
await callApi(apiToken)  // TypeScript knows it's defined
```

## Common Environment Variables

### AWS Service Configuration

```typescript
// AWS service settings
AWS_REGION            // AWS region (default: us-west-2)
AWS_ACCOUNT_ID        // AWS account ID

// DynamoDB
TABLE_NAME            // DynamoDB table name
DYNAMODB_ENDPOINT     // Override for LocalStack

// S3
BUCKET_NAME           // S3 bucket name
S3_ENDPOINT           // Override for LocalStack
S3_FORCE_PATH_STYLE   // true for LocalStack
S3_ACCELERATE         // Enable transfer acceleration

// Lambda
LAMBDA_ENDPOINT       // Override for LocalStack

// SNS/SQS
SNS_TOPIC_ARN         // SNS topic ARN
SQS_QUEUE_URL         // SQS queue URL
```

### Feature Flags

```typescript
// Observability
ENABLE_XRAY           // Enable X-Ray tracing (true/false)
LOG_LEVEL             // Logging level (debug/info/warn/error)

// Operational
DRY_RUN               // Test mode without side effects (true/false)
DEBUG                 // Enable debug logging (true/false)

// Testing
USE_LOCALSTACK        // Use LocalStack instead of AWS (true/false)
```

### Application Settings

```typescript
// Performance tuning
MAX_RETRIES           // Maximum retry attempts (number)
TIMEOUT_MS            // Operation timeout in milliseconds (number)
BATCH_SIZE            // Batch processing size (number)

// External services
API_TOKEN             // API authentication token
WEBHOOK_URL           // Webhook callback URL
GITHUB_TOKEN          // GitHub API token
```

## Type Safety for Environment Variables

```typescript
// util/env.ts

/**
 * Gets required environment variable
 * @throws Error if variable not set
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`)
  }
  return value
}

/**
 * Gets optional environment variable with default
 */
export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

/**
 * Gets boolean environment variable
 */
export function getBoolEnv(name: string, defaultValue = false): boolean {
  const value = process.env[name]
  if (!value) return defaultValue
  return value.toLowerCase() === 'true'
}

/**
 * Gets numeric environment variable
 */
export function getNumEnv(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${value}`)
  }
  return parsed
}

// Usage
const tableName = getRequiredEnv('TABLE_NAME')
const region = getEnv('AWS_REGION', 'us-west-2')
const enableXRay = getBoolEnv('ENABLE_XRAY', true)
const maxRetries = getNumEnv('MAX_RETRIES', 3)
```

## Configuration Object Pattern

```typescript
// config/lambda-config.ts

export interface LambdaConfig {
  aws: {
    region: string
    accountId?: string
  }
  dynamodb: {
    tableName: string
    endpoint?: string
  }
  s3: {
    bucketName: string
    endpoint?: string
    useAcceleration: boolean
  }
  features: {
    enableXRay: boolean
    dryRun: boolean
  }
  performance: {
    maxRetries: number
    timeoutMs: number
  }
}

export function loadConfig(): LambdaConfig {
  return {
    aws: {
      region: getEnv('AWS_REGION', 'us-west-2'),
      accountId: process.env.AWS_ACCOUNT_ID
    },
    dynamodb: {
      tableName: getRequiredEnv('TABLE_NAME'),
      endpoint: process.env.DYNAMODB_ENDPOINT
    },
    s3: {
      bucketName: getRequiredEnv('BUCKET_NAME'),
      endpoint: process.env.S3_ENDPOINT,
      useAcceleration: getBoolEnv('S3_ACCELERATE', false)
    },
    features: {
      enableXRay: getBoolEnv('ENABLE_XRAY', true),
      dryRun: getBoolEnv('DRY_RUN', false)
    },
    performance: {
      maxRetries: getNumEnv('MAX_RETRIES', 3),
      timeoutMs: getNumEnv('TIMEOUT_MS', 300000)
    }
  }
}

// Usage in handler
const config = loadConfig()
console.log('Using bucket:', config.s3.bucketName)
```

## Testing with Environment Variables

```typescript
// test/lambdas/DownloadVideo/index.test.ts

describe('DownloadVideo handler', () => {
  const originalEnv = process.env
  
  beforeEach(() => {
    // Restore environment before each test
    jest.resetModules()
    process.env = {...originalEnv}
    
    // Set test environment variables
    process.env.TABLE_NAME = 'TestTable'
    process.env.BUCKET_NAME = 'test-bucket'
    process.env.AWS_REGION = 'us-west-2'
    process.env.ENABLE_XRAY = 'false'  // Disable X-Ray in tests
  })
  
  afterAll(() => {
    // Restore original environment
    process.env = originalEnv
  })
  
  it('uses environment configuration', async () => {
    const {handler} = await import('../src/index')
    
    // Handler uses environment variables
    const result = await handler(event, context)
    
    expect(result.statusCode).toBe(200)
  })
  
  it('throws on missing required variable', async () => {
    delete process.env.TABLE_NAME
    
    // Re-import to apply new environment
    jest.resetModules()
    
    await expect(async () => {
      await import('../src/index')
    }).rejects.toThrow('TABLE_NAME')
  })
})
```

## Rationale

### Consistent Naming Benefits

1. **Discoverability** - Easy to find related configuration
2. **Standards Compliance** - Follows Unix/Linux conventions
3. **Tool Compatibility** - Works with shell scripts and CI/CD
4. **No Ambiguity** - Clear what each variable controls

### Defaults Benefits

1. **Development Experience** - Works locally with minimal setup
2. **Backward Compatibility** - New variables don't break existing code
3. **Graceful Degradation** - Non-critical features work without config
4. **Testing** - Tests work with minimal environment setup

## Enforcement

### Code Review Checklist

- [ ] All environment variables use SCREAMING_SNAKE_CASE
- [ ] Required variables validated at startup
- [ ] Secrets never hard-coded
- [ ] Sensible defaults for non-secrets
- [ ] Boolean variables use strict 'true' check
- [ ] Numeric variables parsed with error handling
- [ ] Documentation includes all required variables

### Automated Checks

```bash
# Check for lowercase environment variables
grep -rn "process\.env\.[a-z]" src/ lib/ | grep -v "// eslint-disable"

# Check for hard-coded secrets (basic check)
grep -rn "token.*=.*['\"]sk-" src/ lib/
grep -rn "password.*=.*['\"]" src/ lib/
```

## Documentation

Document required environment variables in README or Lambda-specific docs:

```markdown
## Environment Variables

### Required

- `TABLE_NAME` - DynamoDB table name
- `BUCKET_NAME` - S3 bucket for media files
- `API_TOKEN` - Feedly API token

### Optional

- `AWS_REGION` - AWS region (default: us-west-2)
- `ENABLE_XRAY` - Enable X-Ray tracing (default: true)
- `MAX_RETRIES` - Retry attempts (default: 3)
- `S3_ACCELERATE` - Use S3 transfer acceleration (default: false)

### Testing

- `USE_LOCALSTACK` - Use LocalStack for testing (default: false)
- `S3_ENDPOINT` - S3 endpoint override for LocalStack
- `DYNAMODB_ENDPOINT` - DynamoDB endpoint override for LocalStack
```

## Related Patterns

- [Naming Conventions](../Conventions/Naming-Conventions.md) - SCREAMING_SNAKE_CASE for constants
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Configuration in handlers
- [Infrastructure/Environment-Variables](../Infrastructure/Environment-Variables.md) - OpenTofu configuration

---

*Use SCREAMING_SNAKE_CASE for environment variables, provide sensible defaults for non-secrets, and validate required configuration at startup.*
