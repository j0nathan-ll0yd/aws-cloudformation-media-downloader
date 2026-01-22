# Vendor Encapsulation Pattern Deep Dive

## Executive Summary

The vendor encapsulation pattern is a **CRITICAL** architectural convention that isolates all third-party library interactions behind a unified wrapper layer in `src/lib/vendor/`. This pattern provides environment-aware configuration, centralized instrumentation, improved testability, and type safety across the codebase.

**Enforcement Level**: ZERO TOLERANCE
**Applies To**: AWS SDK, Drizzle ORM, Better Auth, OpenTelemetry, yt-dlp, and all third-party services

---

## Pattern Analysis

### 1. AWS SDK Wrapping Approach

**Location**: `src/lib/vendor/AWS/`

The AWS SDK v3 is wrapped through a two-layer architecture:

#### Central Client Factory (`clients.ts`)
```typescript
// Single point for all AWS client instantiation
export function createS3Client(): S3Client {
  const config: S3ClientConfig = {
    ...getBaseConfig(),
    forcePathStyle: isLocalStackMode()  // LocalStack compatibility
  }
  return new S3Client(config)
}
```

Key characteristics:
- **Lazy initialization**: Clients are created on first use
- **Environment detection**: Automatic LocalStack vs production configuration
- **Consistent region handling**: Falls back to `AWS_REGION` environment variable
- **Type-safe configuration**: Each client has proper TypeScript typing

#### Service-Specific Wrappers (for example, `S3.ts`, `DynamoDB.ts`)
```typescript
// Domain-focused API instead of raw SDK commands
export async function headObject(bucket: string, key: string): Promise<HeadObjectCommandOutput> {
  const params: HeadObjectCommandInput = {Bucket: bucket, Key: key}
  const command = new HeadObjectCommand(params)
  return s3Client.send(command)
}
```

Benefits:
- Simpler API surface for Lambda handlers
- Consistent error handling patterns
- Single mock point for testing

### 2. LocalStack Detection Mechanism

**Location**: `src/lib/vendor/AWS/clients.ts`

```typescript
function isLocalStackMode(): boolean {
  return process.env.USE_LOCALSTACK === 'true'
}

function getBaseConfig() {
  if (isLocalStackMode()) {
    return {
      endpoint: 'http://localhost:4566',
      region: AWS_REGION,
      credentials: {accessKeyId: 'test', secretAccessKey: 'test'}
    }
  }
  return {region: AWS_REGION}
}
```

How it works:
1. **Environment variable trigger**: `USE_LOCALSTACK=true` switches to local mode
2. **Endpoint override**: Points to LocalStack at `localhost:4566`
3. **Dummy credentials**: Uses `test/test` for local authentication
4. **Path-style URLs**: S3 uses path-style for LocalStack compatibility

This enables seamless switching between local integration tests and production without code changes.

### 3. OpenTelemetry Tracing Integration

**Location**: `src/lib/vendor/OpenTelemetry/index.ts`

The project migrated from `aws-xray-sdk-core` to native OpenTelemetry for ESM compatibility:

```typescript
export function startSpan(name: string, kind: SpanKind = SpanKind.INTERNAL): Span | null {
  if (!isTracingEnabled()) {
    return null
  }
  return getTracer().startSpan(name, {kind})
}

export function endSpan(span: Span | null, error?: Error): void {
  if (!span) return
  if (error) {
    span.setStatus({code: SpanStatusCode.ERROR, message: error.message})
    span.recordException(error)
  }
  span.end()
}
```

Key features:
- **Null-safe operations**: All functions handle disabled tracing gracefully
- **Automatic AWS SDK tracing**: OpenTelemetry's AwsInstrumentation traces all SDK calls
- **X-Ray compatible**: Annotations and metadata format compatible with AWS X-Ray
- **Higher-order wrapper**: `withTracing()` extracts trace IDs for Lambda handlers

Tracing is disabled when:
- `ENABLE_XRAY=false`
- `USE_LOCALSTACK=true` (LocalStack doesn't support X-Ray)

### 4. Drizzle ORM Wrapper Structure

**Location**: `src/lib/vendor/Drizzle/`

The Drizzle ORM wrapper provides Aurora DSQL integration with IAM authentication:

#### Client (`client.ts`)
```typescript
export async function getDrizzleClient(): Promise<PostgresJsDatabase<typeof schema>> {
  const now = Date.now()

  // Return cached client if token is still valid
  if (cachedClient && tokenExpiry > now + TOKEN_REFRESH_BUFFER_MS) {
    return cachedClient
  }

  // Generate new IAM token via SigV4 signing
  const signer = new DsqlSigner({hostname: endpoint, region})
  const token = await signer.getDbConnectAdminAuthToken()

  cachedSql = postgres({
    host: endpoint,
    password: token,
    ssl: 'require',
    // ... other config
  })

  cachedClient = drizzle(cachedSql, {schema})
  tokenExpiry = now + TOKEN_VALIDITY_MS
  return cachedClient
}
```

Key features:
- **IAM authentication**: No static passwords, uses SigV4 signing
- **Token refresh**: Proactive refresh before 15-minute expiration
- **Connection caching**: Reuses connections across Lambda warm starts
- **Test mode support**: Switches to local PostgreSQL for tests

#### Types (`types.ts`)
```typescript
// Re-export operators for domain code
export { and, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or, sql } from 'drizzle-orm'

// Type utilities for entity definitions
export type SelectModel<T extends PgTable> = InferSelectModel<T>
export type InsertModel<T extends PgTable> = InferInsertModel<T>
```

---

## Benefits Realized

### Single Mock Point for Testing
Instead of mocking multiple AWS SDK calls:
```typescript
// BAD: Multiple mocks scattered across tests
vi.mock('@aws-sdk/client-s3')
vi.mock('@aws-sdk/client-dynamodb')
vi.mock('@aws-sdk/client-sns')

// GOOD: Single vendor wrapper mock
vi.mock('#lib/vendor/AWS/S3', () => ({
  headObject: vi.fn(),
  createS3Upload: vi.fn()
}))
```

### Environment-Aware Configuration
- Production: Real AWS endpoints, IAM credentials, X-Ray tracing
- LocalStack: Local endpoints, dummy credentials, tracing disabled
- Testing: Mocked vendor layer, no infrastructure dependencies

### Centralized Instrumentation
All observability concerns are handled at the vendor layer:
- Tracing spans automatically created for AWS operations
- Metrics recording for connection events (Drizzle)
- Logging integrated with Powertools

### Type Safety Improvements
- Domain-specific types instead of raw SDK types
- Inferred types from schema definitions
- Compile-time validation of operations

---

## Enforcement Mechanisms

### AST-Based Validation Rules

The MCP validation system enforces encapsulation via CRITICAL severity rules:

| Rule | Package | Status |
|------|---------|--------|
| `aws-sdk-encapsulation` | `@aws-sdk/*`, `@opentelemetry/*`, `@aws-lambda-powertools/*` | Active |
| `drizzle-orm-encapsulation` | `drizzle-orm`, `drizzle-orm/*`, `postgres` | Active |

Both rules:
- Scan static imports for forbidden packages
- Detect dynamic imports via AST analysis
- Provide helpful suggestions pointing to correct vendor wrappers
- Skip files within the vendor directories (where direct imports are allowed)

### CI/CD Integration

The `agent-compliance.yml` workflow runs validation on every PR:

```yaml
- name: Run convention validation
  run: pnpm run validate:conventions
```

Exit behavior:
- **CRITICAL/HIGH violations** → CI failure (exit code 1)
- **MEDIUM/LOW violations** → Warning only (exit code 0)

### MCP Tool Integration

The `validate_pattern` MCP tool provides on-demand validation:

```bash
# Validate a specific file
pnpm run mcp:validate src/lambdas/MyLambda/src/index.ts

# Validate with specific rule
pnpm run mcp:validate src/lambdas/MyLambda/src/index.ts --rules drizzle-orm-encapsulation
```

---

## Extension Points

### Adding New AWS Services

1. Add client factory function to `clients.ts`:
```typescript
export function createNewServiceClient(): NewServiceClient {
  const config: NewServiceClientConfig = getBaseConfig()
  return new NewServiceClient(config)
}
```

2. Create service wrapper at `src/lib/vendor/AWS/NewService.ts`:
```typescript
import {createNewServiceClient} from './clients'

const client = createNewServiceClient()

export async function performOperation(params: Params): Promise<Result> {
  const command = new SomeCommand(params)
  return client.send(command)
}
```

3. Add to `VENDOR_SUGGESTIONS` in `aws-sdk-encapsulation.ts`

### Adding New Vendor Libraries

1. Create wrapper directory: `src/lib/vendor/VendorName/`
2. Implement lazy initialization pattern
3. Add environment detection if needed (for example, test mode)
4. Export domain-specific functions
5. Add validation rule if zero-tolerance enforcement required
6. Update `Vendor-Encapsulation-Policy.md`

---

## Lessons Learned

### What Worked Well
- **Gradual migration**: Started with AWS SDK, extended to Drizzle ORM
- **Comprehensive testing**: Fixtures cover valid and invalid patterns
- **Helpful error messages**: Suggestions guide developers to correct usage
- **CI enforcement**: Catches violations before merge

### Pain Points Addressed
- **ESM compatibility**: OpenTelemetry migration solved aws-xray-sdk-core CJS issues
- **Token refresh**: Proactive refresh prevents connection failures
- **Test isolation**: Worker-scoped schemas enable parallel testing

### Future Improvements
- Consider adding connection pooling metrics
- Evaluate adding retry logic at vendor layer
- Explore automated migration tooling for violations

---

## References

- [Vendor Encapsulation Policy](./Vendor-Encapsulation-Policy.md) - Quick reference and examples
- [LocalStack Testing](../Testing/LocalStack-Testing.md) - Integration testing setup
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Test patterns
