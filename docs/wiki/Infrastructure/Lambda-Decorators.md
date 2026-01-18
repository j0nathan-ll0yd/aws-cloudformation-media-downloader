# Lambda Class Decorators

This document describes the class decorators available for Lambda handlers that declare infrastructure requirements.

## Overview

Lambda class decorators provide declarative infrastructure requirements in code. They enable:
- **Self-documenting dependencies**: Infrastructure requirements are visible in the handler code
- **Build-time extraction**: Metadata can be extracted for Terraform/IAM generation
- **MCP validation**: Declared permissions are validated against actual usage
- **Type-safe declarations**: Full TypeScript support with enums for services and operations

## Available Decorators

| Decorator | Purpose | Severity |
|-----------|---------|----------|
| `@RequiresDatabase` | Database table access permissions | HIGH |
| `@RequiresSecrets` | Secrets Manager/Parameter Store dependencies | HIGH |
| `@RequiresServices` | AWS service dependencies (S3, SQS, SNS, EventBridge) | HIGH |
| `@RequiresEventBridge` | EventBridge event patterns published/subscribed | HIGH |

## @RequiresDatabase

Declares which database tables and operations a Lambda handler requires.

### Import

```typescript
import {RequiresDatabase} from '#lib/lambda/handlers'
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'
```

### Usage

```typescript
@RequiresDatabase([
  {table: DatabaseTable.Users, operations: [DatabaseOperation.Select]},
  {table: DatabaseTable.Files, operations: [DatabaseOperation.Select, DatabaseOperation.Insert]}
])
class MyHandler extends AuthenticatedHandler {
  // handler implementation
}
```

### Enums

**DatabaseTable:**
- `Users`, `Files`, `FileDownloads`, `Devices`, `Sessions`, `Accounts`, `VerificationTokens`, `UserFiles`, `UserDevices`

**DatabaseOperation:**
- `Select`, `Insert`, `Update`, `Delete`, `All`

## @RequiresSecrets

Declares which Secrets Manager secrets or Parameter Store parameters a Lambda handler requires.

### Import

```typescript
import {RequiresSecrets} from '#lib/lambda/handlers'
import {SecretType} from '#types/secretPermissions'
```

### Usage

```typescript
@RequiresSecrets([
  {type: SecretType.SecretsManager, name: 'apns/certificate'},
  {type: SecretType.ParameterStore, name: '/youtube/cookies', encrypted: true}
])
class MyHandler extends SqsHandler {
  // handler implementation
}
```

### Types

**SecretType:**
- `SecretsManager` - AWS Secrets Manager secret
- `ParameterStore` - AWS Systems Manager Parameter Store parameter

**SecretPermission:**
- `type`: The secret source type
- `name`: The secret/parameter name or ARN pattern
- `encrypted`: (optional) For SSM SecureString parameters

## @RequiresServices

Declares which AWS services (S3, SQS, SNS, EventBridge) a Lambda handler uses.

### Import

```typescript
import {RequiresServices} from '#lib/lambda/handlers'
import {AWSService, S3Operation, SQSOperation, SNSOperation, EventBridgeOperation} from '#types/servicePermissions'
```

### Usage

```typescript
@RequiresServices([
  {service: AWSService.S3, resource: 'media-bucket/*', operations: [S3Operation.GetObject, S3Operation.PutObject]},
  {service: AWSService.SQS, resource: 'download-queue', operations: [SQSOperation.SendMessage]},
  {service: AWSService.SNS, resource: 'notification-topic', operations: [SNSOperation.Publish]}
])
class MyHandler extends ApiHandler {
  // handler implementation
}
```

### Enums

**AWSService:**
- `S3`, `SQS`, `SNS`, `EventBridge`

**S3Operation:**
- `GetObject`, `PutObject`, `DeleteObject`, `ListBucket`, `HeadObject`

**SQSOperation:**
- `SendMessage`, `ReceiveMessage`, `DeleteMessage`, `GetQueueAttributes`, `GetQueueUrl`

**SNSOperation:**
- `Publish`, `Subscribe`

**EventBridgeOperation:**
- `PutEvents`

## @RequiresEventBridge

Declares which EventBridge events a Lambda handler publishes or subscribes to.

### Import

```typescript
import {RequiresEventBridge} from '#lib/lambda/handlers'
```

### Usage

```typescript
@RequiresEventBridge({
  publishes: ['DownloadRequested', 'DownloadCompleted', 'DownloadFailed'],
  subscribes: ['ArticleReceived'],
  eventBus: 'default'  // optional, defaults to 'default'
})
class MyHandler extends SqsHandler {
  // handler implementation
}
```

### Properties

- `publishes`: Array of event detail-types this Lambda publishes
- `subscribes`: Array of event detail-types this Lambda subscribes to
- `eventBus`: (optional) Custom event bus name

## Combining Decorators

Decorators can be combined on a single handler class:

```typescript
@RequiresDatabase([
  {table: DatabaseTable.Files, operations: [DatabaseOperation.Select, DatabaseOperation.Insert, DatabaseOperation.Update]},
  {table: DatabaseTable.FileDownloads, operations: [DatabaseOperation.Select, DatabaseOperation.Insert, DatabaseOperation.Update]}
])
@RequiresServices([
  {service: AWSService.S3, resource: 'media-bucket/*', operations: [S3Operation.HeadObject, S3Operation.PutObject]},
  {service: AWSService.SQS, resource: 'notification-queue', operations: [SQSOperation.SendMessage]},
  {service: AWSService.EventBridge, resource: 'default', operations: [EventBridgeOperation.PutEvents]}
])
@RequiresEventBridge({
  publishes: ['DownloadCompleted', 'DownloadFailed']
})
class StartFileUploadHandler extends SqsHandler {
  // handler implementation
}
```

## Build-Time Extraction

Extraction scripts parse Lambda handler files using ts-morph and generate JSON manifests:

```bash
# Extract database permissions
pnpm run extract:db-permissions
# Output: build/db-permissions.json

# Extract secret permissions
pnpm run extract:secret-permissions
# Output: build/secret-permissions.json

# Extract service permissions
pnpm run extract:service-permissions
# Output: build/service-permissions.json

# Extract EventBridge permissions
pnpm run extract:eventbridge-permissions
# Output: build/eventbridge-permissions.json
```

## MCP Validation

The MCP server validates that:

1. **Database permissions**: Lambdas importing entity queries have `@RequiresDatabase` with matching tables
2. **Secret permissions**: Lambdas importing secret utilities have `@RequiresSecrets`
3. **Service permissions**: Lambdas importing AWS vendor wrappers have `@RequiresServices`
4. **EventBridge permissions**: Lambdas calling `publishEvent()` have `@RequiresEventBridge` with matching event types

Run validation:

```bash
pnpm run validate:conventions
```

## Runtime Behavior

These decorators attach metadata to handler classes but do not modify runtime behavior. They are used solely for:

1. Documentation
2. Build-time extraction
3. Static analysis and validation

The actual permissions must still be configured in IAM policies via Terraform.

## Related Documentation

- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md)
- [Entity Query Patterns](../TypeScript/Entity-Query-Patterns.md)
- [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md)
