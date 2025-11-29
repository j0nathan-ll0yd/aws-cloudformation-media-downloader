# Formatting Examples Comparison

This document shows how different formatters handle specific code patterns from this project.

## Example 1: Inline Object Types

### Original Code (Prettier formatted)
```typescript
// From src/types/main.d.ts
interface DeviceRegistrationRequest {name: string; token: string; systemVersion: string; deviceId: string; systemName: string}
```

### Prettier Output (current)
```typescript
// Stays on one line if under 250 chars
interface DeviceRegistrationRequest {name: string; token: string; systemVersion: string; deviceId: string; systemName: string}
```

### Biome Output
```typescript
// Similar to Prettier - will keep on one line if under lineWidth
// Can be improved with future configuration options
interface DeviceRegistrationRequest {name: string; token: string; systemVersion: string; deviceId: string; systemName: string}

// Workaround: Use explicit line breaks in source
interface DeviceRegistrationRequest {
  name: string
  token: string
  systemVersion: string
  deviceId: string
  systemName: string
}
```

### dprint Output
```typescript
// With objectExpression.preferSingleLine: false
interface DeviceRegistrationRequest {
  name: string
  token: string
  systemVersion: string
  deviceId: string
  systemName: string
}
```

### ESLint + @stylistic Output
```typescript
// With object-property-newline and minProperties: 3
interface DeviceRegistrationRequest {
  name: string
  token: string
  systemVersion: string
  deviceId: string
  systemName: string
}
```

**Winner: dprint / ESLint @stylistic** - Both provide explicit control over multi-line object types.

---

## Example 2: Method Chaining

### Original Code
```typescript
// From test code - ElectroDB query chains
const userFilesResponse = await UserFiles.query.byUser({userId}).go()

// Longer chain example
const response = await Files.get(fileKeys).go({concurrency: 5, attributes: ['fileId', 'key', 'status']})
```

### Prettier Output (current)
```typescript
// Prettier will keep on one line if under 250 chars
const userFilesResponse = await UserFiles.query.byUser({userId}).go()

// Even longer chains stay on one line
const response = await Files.get(fileKeys).go({concurrency: 5, attributes: ['fileId', 'key', 'status']})
```

### Biome Output
```typescript
// Similar to Prettier - limited control
const userFilesResponse = await UserFiles.query.byUser({userId}).go()

const response = await Files.get(fileKeys).go({concurrency: 5, attributes: ['fileId', 'key', 'status']})
```

### dprint Output
```typescript
// With memberExpression.linePerExpression: true
const userFilesResponse = await UserFiles.query
  .byUser({userId})
  .go()

const response = await Files
  .get(fileKeys)
  .go({concurrency: 5, attributes: ['fileId', 'key', 'status']})
```

### ESLint + @stylistic Output
```typescript
// With newline-per-chained-call: {ignoreChainWithDepth: 2}
const userFilesResponse = await UserFiles.query
  .byUser({userId})
  .go()

const response = await Files
  .get(fileKeys)
  .go({
    concurrency: 5,
    attributes: ['fileId', 'key', 'status']
  })
```

**Winner: dprint** - Provides cleanest method chain formatting with granular control.

---

## Example 3: Lambda Function Signatures

### Original Code
```typescript
// From src/lambdas/ListFiles/src/index.ts
export const handler = withXRay(async (event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> => {
  // function body
})
```

### Prettier Output (current)
```typescript
// Stays on one line (under 250 chars)
export const handler = withXRay(async (event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> => {
  // function body
})
```

### Biome Output
```typescript
// Similar to Prettier
export const handler = withXRay(async (event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> => {
  // function body
})
```

### dprint Output
```typescript
// With parameters.preferSingleLine: false and appropriate lineWidth
export const handler = withXRay(
  async (
    event: CustomAPIGatewayRequestAuthorizerEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    // function body
  }
)
```

### ESLint + @stylistic Output
```typescript
// With function-paren-newline: "multiline"
export const handler = withXRay(
  async (
    event: CustomAPIGatewayRequestAuthorizerEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    // function body
  }
)
```

**Note**: This case is debatable - the single line might be acceptable given the 250 char limit. The formatters respect the current readable format.

---

## Example 4: ElectroDB Entity Configuration

### Original Code
```typescript
// From src/entities/Files.ts
export const Files = new Entity(
  {
    model: {
      entity: 'File',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      fileId: {
        type: 'string',
        required: true,
        readOnly: true
      },
      // ... more attributes
    }
  } as const,
  {
    table: process.env.DynamoDBTableName,
    client: documentClient
  }
)
```

### All Formatters Output
```typescript
// All formatters preserve this structure well
// The explicit line breaks in the source are maintained
export const Files = new Entity(
  {
    model: {
      entity: 'File',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      fileId: {
        type: 'string',
        required: true,
        readOnly: true
      },
      // ... more attributes
    }
  } as const,
  {
    table: process.env.DynamoDBTableName,
    client: documentClient
  }
)
```

**Winner: All formatters** - This structure is well-handled by all tools.

---

## Example 5: Import Statements

### Original Code
```typescript
// From src/lambdas/WebhookFeedly/src/index.ts
import {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,
  APIGatewayProxyEventMultiValueQueryStringParameters,
  APIGatewayProxyEventPathParameters,
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventStageVariables
} from 'aws-lambda/trigger/api-gateway-proxy'
```

### Prettier Output (current)
```typescript
// Prettier will keep this multi-line format
import {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,
  APIGatewayProxyEventMultiValueQueryStringParameters,
  APIGatewayProxyEventPathParameters,
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventStageVariables
} from 'aws-lambda/trigger/api-gateway-proxy'
```

### All Formatters Output
```typescript
// All formatters handle this well
import {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,
  APIGatewayProxyEventMultiValueQueryStringParameters,
  APIGatewayProxyEventPathParameters,
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventStageVariables
} from 'aws-lambda/trigger/api-gateway-proxy'
```

**Winner: All formatters** - Import statements are handled consistently.

---

## Example 6: Array/Object Destructuring

### Original Code
```typescript
const {data: files, unprocessed} = await Files.get(fileKeys).go({concurrency: 5})
```

### Prettier Output (current)
```typescript
const {data: files, unprocessed} = await Files.get(fileKeys).go({concurrency: 5})
```

### Biome Output
```typescript
// Similar to Prettier
const {data: files, unprocessed} = await Files.get(fileKeys).go({concurrency: 5})
```

### dprint Output
```typescript
// With appropriate settings can break differently
const {data: files, unprocessed} = await Files
  .get(fileKeys)
  .go({concurrency: 5})
```

### ESLint + @stylistic Output
```typescript
// With destructuring rules
const {data: files, unprocessed} = await Files
  .get(fileKeys)
  .go({concurrency: 5})
```

**Winner: Depends on preference** - Single line is readable in this case.

---

## Summary: Formatting Control Comparison

| Pattern | Prettier | Biome | dprint | ESLint @stylistic |
|---------|----------|-------|--------|-------------------|
| **Inline Object Types** | ❌ No control | ⚠️ Limited | ✅ Full control | ✅ Full control |
| **Method Chaining** | ❌ No control | ⚠️ Limited | ✅ Full control | ✅ Full control |
| **Function Signatures** | ⚠️ Line width only | ⚠️ Line width only | ✅ Parameter control | ✅ Parameter control |
| **Import Statements** | ✅ Good | ✅ Good | ✅ Good | ✅ Good |
| **Nested Objects** | ✅ Good | ✅ Good | ✅ Excellent | ✅ Excellent |

## Recommendations by Use Case

### If you need...

**Quick improvement with minimal effort:**
→ **Biome** - Drop-in replacement, slightly better than Prettier

**Maximum control over method chains:**
→ **dprint** - Best configuration for method chaining patterns

**Maximum control over everything:**
→ **ESLint + @stylistic** - Every aspect configurable, but highest complexity

**To stick with familiar tools:**
→ **Stay with Prettier** - Use type aliases and `// prettier-ignore` as needed

## Configuration Snippets

### Biome - Matching Current Prettier
```json
{
  "formatter": {
    "lineWidth": 250,
    "indentWidth": 2
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "none",
      "bracketSpacing": false
    }
  }
}
```

### dprint - For Better Method Chain Control
```json
{
  "typescript": {
    "lineWidth": 250,
    "memberExpression.linePerExpression": true,
    "objectExpression.preferSingleLine": false,
    "quoteStyle": "preferSingle",
    "semiColons": "asi",
    "trailingCommas": "never"
  }
}
```

### ESLint - For Maximum Control
```javascript
{
  rules: {
    '@stylistic/newline-per-chained-call': ['error', {ignoreChainWithDepth: 2}],
    '@stylistic/object-property-newline': ['error', {allowAllPropertiesOnSameLine: false}],
    '@stylistic/max-len': ['error', {code: 250}],
    '@stylistic/quotes': ['error', 'single'],
    '@stylistic/semi': ['error', 'never']
  }
}
```
