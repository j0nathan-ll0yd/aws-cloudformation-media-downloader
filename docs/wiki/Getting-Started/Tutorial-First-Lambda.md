# Tutorial: Create Your First Lambda Function

This tutorial guides you through creating a new Lambda function in the Media Downloader project, from directory setup to deployment.

## Prerequisites

Before starting, ensure you have:
- Node.js 22.x installed
- pnpm package manager (`npm install -g pnpm`)
- Project dependencies installed (`pnpm install`)
- Basic understanding of TypeScript and AWS Lambda

## Learning Objectives

By the end of this tutorial, you:
1. Create the Lambda directory structure
2. Write a handler following project patterns
3. Use vendor wrappers for AWS SDK calls
4. Write tests with entity fixtures
5. Define OpenTofu resources
6. Validate with MCP conventions

## Step 1: Create the Directory Structure

Every Lambda function follows a consistent structure:

```
src/lambdas/[LambdaName]/
├── src/
│   └── index.ts       # Handler implementation
└── test/
    └── index.test.ts  # Unit tests
```

Create your Lambda directory:

```bash
mkdir -p src/lambdas/GetUserProfile/src
mkdir -p src/lambdas/GetUserProfile/test
```

## Step 2: Write the Handler

Create `src/lambdas/GetUserProfile/src/index.ts`:

```typescript
/**
 * GetUserProfile Lambda
 *
 * @description Retrieves user profile information including email and status
 * @trigger API Gateway GET /user/profile
 * @auth Required - uses ApiGatewayAuthorizer
 * @database Aurora DSQL - reads from Users table
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUser } from '#entities/queries';
import { buildValidatedResponse } from '#lib/lambda/responses';
import { getRequiredEnv } from '#lib/system/env';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'GetUserProfile' });

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const region = getRequiredEnv('AWS_REGION');
  const userId = event.requestContext.authorizer?.userId;

  if (!userId) {
    logger.warn('Missing userId in request context');
    return buildValidatedResponse(401, { error: 'Unauthorized' });
  }

  logger.info('Fetching user profile', { userId });

  const user = await getUser(userId);

  if (!user) {
    logger.warn('User not found', { userId });
    return buildValidatedResponse(404, { error: 'User not found' });
  }

  logger.info('User profile retrieved successfully', { userId });

  return buildValidatedResponse(200, {
    userId: user.userId,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
  });
}
```

### Key Patterns Used

| Pattern | Implementation | Reference |
|---------|----------------|-----------|
| TypeDoc header | JSDoc with trigger, auth, database | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| Response helper | `buildValidatedResponse(statusCode, body)` | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| Entity queries | `#entities/queries` import | [Entity Query Patterns](../TypeScript/Entity-Query-Patterns.md) |
| Environment access | `getRequiredEnv()` inside handler | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| Structured logging | AWS Powertools Logger | [CloudWatch Logging](../AWS/CloudWatch-Logging.md) |

### Anti-Patterns to Avoid

```typescript
// WRONG: Module-level getRequiredEnv
const REGION = getRequiredEnv('AWS_REGION');  // Breaks testing!

// WRONG: Direct AWS SDK import
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';  // Use vendor wrapper!

// WRONG: Raw response object
return { statusCode: 200, body: JSON.stringify(data) };  // Use buildValidatedResponse()!

// WRONG: Underscore-prefixed unused params
handler(event, _context) { }  // Remove unused params entirely!
```

## Step 3: Use Vendor Wrappers for AWS Services

If your Lambda needs to call AWS services directly (not via entities), use vendor wrappers:

```typescript
// Correct: Use vendor wrapper
import { getS3Client, getObject } from '#lib/vendor/AWS/S3';

// Inside handler
const client = getS3Client();
const data = await getObject(client, { Bucket: bucket, Key: key });
```

**Never import AWS SDK directly**. This is a zero-tolerance rule. See [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md).

## Step 4: Write Unit Tests

Create `src/lambdas/GetUserProfile/test/index.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { createUserRow } from '#test/helpers/entity-fixtures';

// Mock ALL dependencies BEFORE importing handler
vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
}));

vi.mock('#lib/system/env', () => ({
  getRequiredEnv: vi.fn().mockReturnValue('us-east-1'),
}));

// Import handler AFTER mocks
import { handler } from '../src/index';
import { getUser } from '#entities/queries';

describe('GetUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createEvent = (userId?: string): APIGatewayProxyEvent => ({
    requestContext: {
      authorizer: userId ? { userId } : undefined,
    },
  } as APIGatewayProxyEvent);

  it('returns user profile for authenticated user', async () => {
    const mockUser = createUserRow({ userId: 'user-123', email: 'test@example.com' });
    (getUser as Mock).mockResolvedValue(mockUser);

    const result = await handler(createEvent('user-123'));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.userId).toBe('user-123');
    expect(body.email).toBe('test@example.com');
  });

  it('returns 401 when userId is missing', async () => {
    const result = await handler(createEvent());

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error).toBe('Unauthorized');
  });

  it('returns 404 when user not found', async () => {
    (getUser as Mock).mockResolvedValue(null);

    const result = await handler(createEvent('nonexistent'));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('User not found');
  });
});
```

### Testing Patterns Used

| Pattern | Implementation | Reference |
|---------|----------------|-----------|
| Mock before import | `vi.mock()` at top of file | [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) |
| Entity fixtures | `createUserRow()` helper | [Mock Factory Patterns](../Testing/Mock-Factory-Patterns.md) |
| Specific mock types | `Mock` from vitest | [Mock Type Annotations](../Testing/Mock-Type-Annotations.md) |
| Clear mocks | `vi.clearAllMocks()` in beforeEach | [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) |

### Run Tests

```bash
# Run tests for this Lambda
pnpm test src/lambdas/GetUserProfile

# Run with coverage
pnpm test --coverage src/lambdas/GetUserProfile
```

## Step 5: Define OpenTofu Resources

Add the Lambda definition in `terraform/lambdas.tf`:

```hcl
module "lambda_get_user_profile" {
  source = "./modules/lambda"

  function_name = "GetUserProfile"
  description   = "Retrieves user profile information"
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 10
  memory_size   = 1024

  environment_variables = {
    AWS_REGION          = var.aws_region
    DSQL_CLUSTER_ID     = aws_dsql_cluster.main.id
    DSQL_ENDPOINT       = aws_dsql_cluster.main.endpoint
  }

  # Attach to API Gateway
  api_gateway_source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
```

Add the API Gateway route in `terraform/api_gateway.tf`:

```hcl
resource "aws_apigatewayv2_route" "get_user_profile" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /user/profile"

  target             = "integrations/${aws_apigatewayv2_integration.get_user_profile.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.custom.id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_integration" "get_user_profile" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda_get_user_profile.invoke_arn
  payload_format_version = "2.0"
}
```

## Step 6: Validate Conventions

Run the MCP validation to ensure your Lambda follows project conventions:

```bash
# Validate specific file
pnpm run validate:conventions

# Or use MCP directly
pnpm run mcp:validate src/lambdas/GetUserProfile/src/index.ts
```

Expected output for a compliant Lambda:
```
Validating: src/lambdas/GetUserProfile/src/index.ts
✓ No AWS SDK direct imports
✓ Uses buildValidatedResponse() helper
✓ No module-level getRequiredEnv
✓ No underscore-prefixed variables
✓ All imports valid
```

## Step 7: Run Full Pre-commit Checks

Before committing, run the full validation suite:

```bash
# Type check + lint
pnpm run precheck

# All tests
pnpm run test

# Convention validation
pnpm run validate:conventions
```

All checks must pass before committing.

## Verification Checklist

Verify your Lambda implementation:

- [ ] Directory structure matches pattern (`src/` and `test/` subdirectories)
- [ ] Handler has TypeDoc header with @description, @trigger, @auth, @database
- [ ] Uses `buildValidatedResponse()` helper for all return statements
- [ ] Uses `getRequiredEnv()` inside handler (not at module level)
- [ ] Entity access via `#entities/queries` (not direct imports)
- [ ] No direct AWS SDK imports (uses vendor wrappers if needed)
- [ ] Tests mock all transitive dependencies
- [ ] Tests use entity fixtures from `#test/helpers/entity-fixtures`
- [ ] OpenTofu resources defined with correct IAM permissions
- [ ] MCP validation passes with no violations

## Troubleshooting

### Tests Fail with "Cannot find module"

Ensure mocks are declared before imports:

```typescript
// WRONG ORDER
import { handler } from '../src/index';
vi.mock('#entities/queries');

// CORRECT ORDER
vi.mock('#entities/queries');
import { handler } from '../src/index';
```

### "getRequiredEnv is not a function" in Tests

Mock the env utility:

```typescript
vi.mock('#lib/system/env', () => ({
  getRequiredEnv: vi.fn().mockReturnValue('test-value'),
}));
```

### MCP Validation Reports "AWS SDK Direct Import"

Check for indirect imports. Use the dependency graph:

```bash
cat build/graph.json | jq '.transitiveDependencies["src/lambdas/GetUserProfile/src/index.ts"]'
```

Ensure all AWS SDK usage goes through `#lib/vendor/AWS/`.

### TypeScript Errors with Entity Types

Ensure you're using the correct import alias:

```typescript
// Correct
import { getUser } from '#entities/queries';

// Wrong - old pattern
import { Users } from '#entities/Users';
```

## Next Steps

1. **Add More Endpoints**: Follow this pattern for additional Lambda functions
2. **Add Integration Tests**: See [LocalStack Testing](../Testing/LocalStack-Testing.md)
3. **Explore Entity Patterns**: See [Entity Query Patterns](../TypeScript/Entity-Query-Patterns.md)
4. **Learn About Observability**: See [Error Handling Patterns](../Observability/Error-Handling-Patterns.md)

## Related Documentation

- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Handler conventions
- [Lambda Reference Index](../TypeScript/Lambda-Reference-Index.md) - All existing Lambdas
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Test patterns
- [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md) - AWS SDK rules
- [OpenTofu Patterns](../Infrastructure/OpenTofu-Patterns.md) - Infrastructure conventions

---

*This tutorial follows the [Good Docs Quickstart template](https://www.thegooddocsproject.dev/) pattern. For feedback or improvements, submit a PR.*
