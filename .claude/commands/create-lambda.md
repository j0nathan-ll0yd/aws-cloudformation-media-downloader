# Lambda Scaffolding

Create a new Lambda function with standardized structure, tests, and infrastructure.

## Quick Start

```bash
# Usage: /create-lambda <name> <trigger-type>
# Example: /create-lambda ProcessPayment api-gateway
# Example: /create-lambda CleanupOldRecords schedule
```

## Trigger Types

| Type | Description | Template |
|------|-------------|----------|
| `api-gateway` | HTTP endpoint with auth | APIGatewayProxyHandler |
| `api-gateway-public` | HTTP endpoint without auth | APIGatewayProxyHandler |
| `s3-event` | S3 object notifications | S3Handler |
| `sqs` | SQS queue consumer | SQSHandler |
| `schedule` | CloudWatch scheduled event | ScheduledHandler |
| `eventbridge` | EventBridge rule trigger | EventBridgeHandler |
| `sns` | SNS topic subscriber | SNSHandler |

## Workflow

### Step 1: Parse Requirements

Extract from command:
- **Name**: PascalCase Lambda name (e.g., `ProcessPayment`)
- **Trigger**: One of the supported trigger types
- **Options**: Optional parameters (auth level, timeout, memory)

### Step 2: Query Similar Patterns

Find existing Lambdas with the same trigger type:

```
MCP Tool: query_lambda
Query: config
Lambda: [existing lambda with same trigger]
```

Use as template for:
- Handler structure
- Error handling patterns
- Test setup
- Terraform configuration

### Step 3: Create Directory Structure

```bash
mkdir -p src/lambdas/${NAME}/src
mkdir -p src/lambdas/${NAME}/test
```

### Step 4: Generate Handler

Create `src/lambdas/${NAME}/src/index.ts`:

#### API Gateway Template

```typescript
import type { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { logger, tracer, metrics } from '#lib/vendor/AWS/Powertools';
import { response } from '#util/response';
import { getRequiredEnv } from '#util/env';

/**
 * ${NAME} Lambda Handler
 *
 * @description [Brief description of what this Lambda does]
 * @trigger API Gateway - [HTTP_METHOD] [/path]
 * @see {@link docs/wiki/Lambdas/${NAME}.md}
 */
export const handler: APIGatewayProxyHandler = async (
  event,
): Promise<APIGatewayProxyResult> => {
  const segment = tracer.getSegment();

  try {
    // Validate input
    const body = JSON.parse(event.body ?? '{}');

    // Get configuration
    const tableName = getRequiredEnv('TABLE_NAME');

    // Implementation
    logger.info('Processing request', { path: event.path });

    // Return success
    return response(200, {
      success: true,
      data: {},
    });
  } catch (error) {
    logger.error('Handler failed', { error });

    if (error instanceof SyntaxError) {
      return response(400, { error: 'Invalid JSON body' });
    }

    return response(500, { error: 'Internal server error' });
  }
};
```

#### SQS Template

```typescript
import type { SQSHandler, SQSBatchResponse } from 'aws-lambda';
import { logger, tracer } from '#lib/vendor/AWS/Powertools';

/**
 * ${NAME} Lambda Handler
 *
 * @description [Brief description]
 * @trigger SQS - [queue-name]
 */
export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      logger.info('Processing message', { messageId: record.messageId });

      // Process message
    } catch (error) {
      logger.error('Failed to process message', {
        messageId: record.messageId,
        error,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
```

#### Schedule Template

```typescript
import type { ScheduledHandler } from 'aws-lambda';
import { logger, tracer } from '#lib/vendor/AWS/Powertools';

/**
 * ${NAME} Lambda Handler
 *
 * @description [Brief description]
 * @trigger CloudWatch Schedule - [cron expression]
 */
export const handler: ScheduledHandler = async (event): Promise<void> => {
  logger.info('Scheduled execution started', { time: event.time });

  try {
    // Implementation
  } catch (error) {
    logger.error('Scheduled execution failed', { error });
    throw error; // Let CloudWatch capture the failure
  }

  logger.info('Scheduled execution completed');
};
```

### Step 5: Generate Test File

Create `src/lambdas/${NAME}/test/index.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../src';

// Mock vendor dependencies
vi.mock('#lib/vendor/AWS/Powertools', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  tracer: {
    getSegment: vi.fn(() => ({ addAnnotation: vi.fn() })),
    captureAsyncFunc: vi.fn((name, fn) => fn()),
  },
  metrics: {
    addMetric: vi.fn(),
  },
}));

vi.mock('#util/env', () => ({
  getRequiredEnv: vi.fn((key: string) => `mock-${key}`),
}));

// Add entity mocks as needed
// vi.mock('#entities/Users', () => ({ ... }));

describe('${NAME}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
    httpMethod: 'POST',
    path: '/path',
    headers: {},
    queryStringParameters: null,
    pathParameters: null,
    body: JSON.stringify({}),
    isBase64Encoded: false,
    requestContext: {} as any,
    resource: '',
    stageVariables: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    ...overrides,
  });

  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: '${NAME}',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789:function:${NAME}',
    memoryLimitInMB: '256',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/${NAME}',
    logStreamName: 'test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };

  describe('successful operations', () => {
    it('should return 200 for valid request', async () => {
      const event = createEvent({
        body: JSON.stringify({ /* valid input */ }),
      });

      const result = await handler(event, mockContext, vi.fn());

      expect(result?.statusCode).toBe(200);
    });
  });

  describe('input validation', () => {
    it('should return 400 for invalid JSON', async () => {
      const event = createEvent({
        body: 'invalid json',
      });

      const result = await handler(event, mockContext, vi.fn());

      expect(result?.statusCode).toBe(400);
    });
  });

  describe('error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      // Setup mock to throw
      // const result = await handler(event, mockContext, vi.fn());
      // expect(result?.statusCode).toBe(500);
    });
  });
});
```

### Step 6: Create Terraform Configuration

Create `terraform/lambda-${name-kebab}.tf`:

```hcl
# Lambda: ${NAME}
# Trigger: ${TRIGGER_TYPE}
# Created: ${DATE}

resource "aws_lambda_function" "${NAME}" {
  function_name = "${NAME}"
  role          = aws_iam_role.${NAME}.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.lambda_${NAME}.output_path
  source_code_hash = data.archive_file.lambda_${NAME}.output_base64sha256

  environment {
    variables = {
      TABLE_NAME    = aws_dynamodb_table.main.name
      NODE_OPTIONS  = "--enable-source-maps"
      POWERTOOLS_SERVICE_NAME = "${NAME}"
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = local.common_tags
}

resource "aws_iam_role" "${NAME}" {
  name = "${NAME}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "${NAME}_basic" {
  role       = aws_iam_role.${NAME}.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Add trigger-specific configuration below
```

### Step 7: Update Metadata

Add entry to `graphrag/metadata.json`:

```json
{
  "name": "${NAME}",
  "trigger": "${TRIGGER_TYPE}",
  "path": "[API path if applicable]",
  "entities": [],
  "purpose": "[Description from command or TSDoc]"
}
```

### Step 8: Apply Conventions

Validate the new files:

```
MCP Tool: apply_convention
Convention: all
File: src/lambdas/${NAME}/src/index.ts
DryRun: true
```

Fix any violations before completing.

### Step 9: Verify Build

```bash
# Ensure esbuild discovers new Lambda
pnpm run build

# Run tests
pnpm test -- --filter=${NAME}

# Type check
pnpm run check-types
```

## Output Format

```markdown
## Lambda Scaffolding Complete

### Created: ${NAME}

**Trigger**: ${TRIGGER_TYPE}

### Files Created

| File | Purpose |
|------|---------|
| `src/lambdas/${NAME}/src/index.ts` | Handler implementation |
| `src/lambdas/${NAME}/test/index.test.ts` | Unit tests |
| `terraform/lambda-${name-kebab}.tf` | Infrastructure |

### Next Steps

1. Implement business logic in handler
2. Add entity imports if needed
3. Expand test coverage
4. Configure trigger in Terraform:
   ${TRIGGER_CONFIG_INSTRUCTION}
5. Add IAM permissions for accessed resources
6. Run full validation: `pnpm run ci:local`

### Validation

- [x] Handler compiles
- [x] Tests pass
- [x] Conventions validated
- [ ] Terraform plan succeeds (run `cd terraform && tofu plan`)
```

## Human Checkpoints

1. **Name and trigger approval** - Before creating files
2. **Review generated code** - Before committing
3. **Terraform plan review** - Verify infrastructure changes before apply
4. **Entity requirements** - Confirm if new entities are needed

---

## Entity Creation Template

If the Lambda requires a new entity:

### Step 1: Define Drizzle Schema

Create `src/lib/vendor/Drizzle/schema/${entity-name}.ts`:

```typescript
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const ${entityName} = pgTable('${table_name}', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Add fields based on requirements
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Step 2: Create Query Module

Create `src/entities/queries/${entity-name}-queries.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { getDb } from '#lib/vendor/Drizzle';
import { ${entityName} } from '#lib/vendor/Drizzle/schema/${entity-name}';

export const get${EntityName} = async (id: string) => {
  const db = getDb();
  return db.select().from(${entityName}).where(eq(${entityName}.id, id));
};

export const create${EntityName} = async (data: typeof ${entityName}.$inferInsert) => {
  const db = getDb();
  return db.insert(${entityName}).values(data).returning();
};
```

### Step 3: Export from Index

Update `src/entities/queries/index.ts`:

```typescript
export * from './${entity-name}-queries';
```

---

## API Gateway Route Configuration

For API Gateway triggered Lambdas:

### Step 1: Add Route to API Gateway Module

In `terraform/api-gateway.tf`, add:

```hcl
resource "aws_api_gateway_resource" "${name}" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "${path}"
}

resource "aws_api_gateway_method" "${name}" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.${name}.id
  http_method   = "${HTTP_METHOD}"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.main.id
}

resource "aws_api_gateway_integration" "${name}" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.${name}.id
  http_method             = aws_api_gateway_method.${name}.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.${NAME}.invoke_arn
}
```

### Step 2: Add Lambda Permission

```hcl
resource "aws_lambda_permission" "${name}_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.${NAME}.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}
```

### Step 3: Terraform Plan Review

**CHECKPOINT**: Before applying infrastructure:

```bash
cd terraform && tofu plan
```

Review the plan output for:
- [ ] Lambda function created correctly
- [ ] IAM role has appropriate permissions
- [ ] API Gateway route configured (if applicable)
- [ ] No unintended resource changes

---

## Notes

- All Lambdas follow the same structure
- Use existing Lambdas as reference for patterns
- Tests must mock all vendor dependencies
- Terraform must follow existing naming conventions
- No AI attribution in generated files
