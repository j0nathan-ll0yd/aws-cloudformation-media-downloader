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

---

## Function-Level Permission Decorators

In addition to class-level decorators on Lambda handlers, this project uses **method-level decorators** on vendor wrapper functions and entity query methods. These provide fine-grained permission documentation at the source of each operation.

### Architecture Overview

The project uses a dual-layer decorator architecture:

```
Lambda Handler (@RequiresDatabase, @RequiresEventBridge)  ← Class-level: precise permissions
    ↓ imports
Service Layer
    ↓ imports
Vendor Wrapper (@RequiresSNS, @RequiresS3, etc.)          ← Method-level: documented at source
Entity Queries (@RequiresTable)                           ← Method-level: documented at source
    ↓ calls
AWS SDK / Drizzle ORM
```

**Why two layers?**

- **Class-level decorators** on Lambda handlers declare the **precise, minimal permissions** the Lambda actually needs. These are used for IAM policy and database role generation.
- **Method-level decorators** on vendor wrappers and entity queries document the permissions each **individual operation** requires. These enable dependency tracing and serve as self-documenting code.

### AWS Service Method Decorators

Located in `src/lib/vendor/AWS/decorators.ts`, these decorators attach permission metadata to vendor wrapper methods.

#### @RequiresSNS

```typescript
import {RequiresSNS} from '#lib/vendor/AWS/decorators'
import {SNSTopicResource, SNSPlatformResource} from '#types/generatedResources'
import {SNSOperation} from '#types/servicePermissions'

class SNSVendor {
  @RequiresSNS(SNSTopicResource.PushNotifications, [SNSOperation.Subscribe])
  static subscribe(params: SubscribeInput): Promise<SubscribeResponse> {
    const command = new SubscribeCommand(params)
    return snsClient.send(command)
  }
}

export const subscribe = SNSVendor.subscribe.bind(SNSVendor)
```

#### @RequiresS3

```typescript
import {RequiresS3} from '#lib/vendor/AWS/decorators'
import {S3Resource} from '#types/generatedResources'
import {S3Operation} from '#types/servicePermissions'

class S3Vendor {
  @RequiresS3(`${S3Resource.Files}/*`, [S3Operation.PutObject, S3Operation.HeadObject])
  static createS3Upload(bucket: string, key: string, body: Readable, contentType: string): Upload {
    // implementation
  }
}

export const createS3Upload = S3Vendor.createS3Upload.bind(S3Vendor)
```

#### @RequiresSQS

```typescript
import {RequiresSQS} from '#lib/vendor/AWS/decorators'
import {SQSResource} from '#types/generatedResources'
import {SQSOperation} from '#types/servicePermissions'

class SQSVendor {
  @RequiresSQS(SQSResource.SendPushNotification, [SQSOperation.SendMessage])
  static sendMessage(params: SendMessageRequest): Promise<SendMessageResult> {
    // implementation
  }
}

export const sendMessage = SQSVendor.sendMessage.bind(SQSVendor)
```

#### @RequiresEventBridge

```typescript
import {RequiresEventBridge} from '#lib/vendor/AWS/decorators'
import {EventBridgeResource} from '#types/generatedResources'
import {EventBridgeOperation} from '#types/servicePermissions'

class EventBridgeVendor {
  @RequiresEventBridge(EventBridgeResource.MediaDownloader, [EventBridgeOperation.PutEvents])
  static publishEvent<TDetail>(detailType: string, detail: TDetail): Promise<PutEventsResponse> {
    // implementation
  }
}

export const publishEvent = EventBridgeVendor.publishEvent.bind(EventBridgeVendor)
```

### DynamoDB/Powertools Method Decorator

Located in `src/lib/vendor/Powertools/decorators.ts`, for idempotency and other DynamoDB operations.

#### @RequiresDynamoDB (Method-Level)

```typescript
import {RequiresDynamoDB} from '#lib/vendor/Powertools/decorators'
import {DynamoDBResource, DynamoDBOperation} from '#types/dynamodbPermissions'

class IdempotencyVendor {
  @RequiresDynamoDB([{
    table: DynamoDBResource.IdempotencyTable,
    operations: [
      DynamoDBOperation.GetItem,
      DynamoDBOperation.PutItem,
      DynamoDBOperation.UpdateItem,
      DynamoDBOperation.DeleteItem
    ]
  }])
  static createPersistenceStore(): DynamoDBPersistenceLayer {
    // implementation
  }
}

export const createPersistenceStore = IdempotencyVendor.createPersistenceStore.bind(IdempotencyVendor)
```

### Entity Query Method Decorator

Located in `src/entities/decorators.ts`, for database table permissions on query methods.

#### @RequiresTable

```typescript
import {RequiresTable, DatabaseOperation, DatabaseTable} from '#entities/decorators'

class UserQueries {
  @RequiresTable([{table: DatabaseTable.Users, operations: [DatabaseOperation.Select]}])
  static getUser(id: string): Promise<UserItem | null> {
    // implementation
  }

  @RequiresTable([{table: DatabaseTable.Users, operations: [DatabaseOperation.Insert]}])
  static createUser(input: CreateUserInput): Promise<UserItem> {
    // implementation
  }
}

export const getUser = UserQueries.getUser.bind(UserQueries)
export const createUser = UserQueries.createUser.bind(UserQueries)
```

**Multi-table queries (JOINs):**

```typescript
@RequiresTable([
  {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select]},
  {table: DatabaseTable.Files, operations: [DatabaseOperation.Select]}
])
static getFilesForUser(userId: string): Promise<FileRow[]> {
  // JOIN query implementation
}
```

### Build-Time Extraction

Extraction scripts parse decorated methods using ts-morph and trace Lambda dependencies:

```bash
# Extract AWS service permissions from vendor wrappers
pnpm run extract:service-permissions
# Output: build/service-permissions.json

# Extract DynamoDB permissions from Powertools wrappers
pnpm run extract:dynamodb-permissions
# Output: build/dynamodb-permissions.json

# Extract database permissions from entity queries
pnpm run extract:entity-permissions
# Output: build/entity-permissions.json
```

### Extraction Flow

1. **Parse**: Extract `@RequiresXxx` decorators from vendor/entity class methods
2. **Map**: Build `className.methodName → permissions` mapping
3. **Trace**: Use `build/graph.json` to find Lambda → file transitive dependencies
4. **Aggregate**: Combine permissions from all imported vendor/entity files
5. **Generate**: Output JSON manifests for Terraform generation

### Permission Generation Sources

| Permission Type | Source | Generator |
|-----------------|--------|-----------|
| Database (DSQL) | `@RequiresDatabase` on Lambda handlers | `build/db-permissions.json` |
| AWS Services | `@RequiresXxx` on vendor wrapper methods | `build/service-permissions.json` |
| DynamoDB | `@RequiresDynamoDB` on Powertools methods | `build/dynamodb-permissions.json` |

**Note**: Database permissions use class-level `@RequiresDatabase` for precise, minimal permissions. The method-level `@RequiresTable` on entity queries serves as documentation and enables future function-level tracing.

### Class vs Method Decorators Summary

| Aspect | Class-Level | Method-Level |
|--------|-------------|--------------|
| **Location** | Lambda handler class | Vendor wrapper / entity query method |
| **Purpose** | Declare Lambda's actual permissions | Document operation's required permissions |
| **Used for generation** | Yes (database permissions) | Yes (AWS service permissions) |
| **Granularity** | Entire Lambda | Single function |
| **Example** | `@RequiresDatabase([...])` | `@RequiresSNS(resource, [ops])` |

## Related Documentation

- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md)
- [Entity Query Patterns](../TypeScript/Entity-Query-Patterns.md)
- [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md)
