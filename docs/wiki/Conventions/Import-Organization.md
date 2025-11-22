# Import Organization

## Quick Reference
- **When to use**: Organizing imports in any TypeScript/JavaScript file
- **Enforcement**: Required - consistent imports improve readability
- **Impact if violated**: Medium - confusion and merge conflicts

## The Rule

### Module System
**Use ES modules (import/export) syntax, not CommonJS (require)**

### Import Order (STRICT)
Imports must follow this exact order with blank lines between groups:

1. **AWS Lambda types** (if Lambda function)
2. **Vendor library imports** (lib/vendor/*)
3. **Type imports** (types/*)
4. **Utility imports** (util/*)
5. **Local/relative imports**
6. **Node built-in modules** (at the end)

### Import Style
- **Destructure imports** when possible
- **Group related imports** from same module
- **Sort alphabetically** within each group
- **Use type imports** for TypeScript types

## Examples

### ✅ Correct - Lambda Function

```typescript
// 1. AWS Lambda type imports FIRST
import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {S3Event, SQSEvent} from 'aws-lambda'

// 2. Vendor library imports (lib/vendor/*)
import {query, updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {createS3Upload, headObject} from '../../../lib/vendor/AWS/S3'
import {sendMessage} from '../../../lib/vendor/AWS/SQS'

// 3. Type imports (types/*)
import type {DynamoDBFile, UserProfile} from '../../../types/main'
import type {FileStatus, UserStatus} from '../../../types/enums'

// 4. Utility imports (util/*)
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {UnexpectedError} from '../../../util/errors'
import {validateRequest} from '../../../util/apigateway-helpers'

// 5. Local imports
import {processFile} from './fileProcessor'
import {validateInput} from './validator'

// 6. Node built-ins (if needed)
import * as path from 'path'
import * as fs from 'fs/promises'

// Handler implementation...
```

### ✅ Correct - Regular TypeScript File

```typescript
// 1. External packages
import express from 'express'
import joi from 'joi'

// 2. Type imports
import type {Request, Response} from 'express'
import type {UserData, Config} from './types'

// 3. Utility imports
import {logger} from './utils/logger'
import {validateEmail, validatePhone} from './utils/validators'

// 4. Local imports
import {UserService} from './services/UserService'
import {DatabaseConnection} from './database'

// 5. Node built-ins
import * as crypto from 'crypto'
import * as util from 'util'
```

### ❌ Incorrect

```typescript
// ❌ WRONG - Mixed order, no grouping
import * as fs from 'fs'  // Built-ins should be last
import {UserService} from './services/UserService'
import {APIGatewayProxyResult} from 'aws-lambda'  // Lambda types should be first
import {logger} from './utils/logger'
import type {UserData} from './types'  // Types before utils
import express from 'express'

// ❌ WRONG - CommonJS syntax
const express = require('express')
const {UserService} = require('./services/UserService')

// ❌ WRONG - Not destructured
import * as lambdaHelpers from '../../../util/lambda-helpers'
// Should be:
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'

// ❌ WRONG - Direct AWS SDK import
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'
// Should use vendor wrapper:
import {createS3Upload} from '../../../lib/vendor/AWS/S3'
```

## Import Styles

### Destructured Imports (Preferred)

```typescript
// ✅ GOOD - Destructured, specific
import {logDebug, logInfo, logError} from './logger'
import {validateEmail, validatePhone} from './validators'

// Use them directly
logDebug('Message')
validateEmail(email)
```

### Namespace Imports (When Needed)

```typescript
// ✅ OK - For modules with many exports or namespace collision
import * as path from 'path'
import * as validators from './validators'

// Use with namespace
path.join('/users', 'profile')
validators.email(email)
```

### Default Imports

```typescript
// ✅ OK - For default exports
import express from 'express'
import YTDlpWrap from 'yt-dlp-wrap'

// Mixed default and named
import React, {useState, useEffect} from 'react'
```

### Type Imports

```typescript
// ✅ GOOD - Explicit type imports
import type {UserProfile, UserSettings} from './types'
import type {Request, Response} from 'express'

// For values and types from same module
import {UserService} from './UserService'
import type {UserServiceConfig} from './UserService'
```

## Special Rules

### AWS SDK Imports (FORBIDDEN)

```typescript
// ❌ NEVER import AWS SDK directly
import {S3Client} from '@aws-sdk/client-s3'
import {LambdaClient} from '@aws-sdk/client-lambda'
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'

// ✅ ALWAYS use vendor wrappers
import {createS3Upload} from '../../../lib/vendor/AWS/S3'
import {invokeLambda} from '../../../lib/vendor/AWS/Lambda'
import {query} from '../../../lib/vendor/AWS/DynamoDB'
```

### Path Imports

```typescript
// ✅ Use relative paths for local files
import {helper} from './helper'
import {service} from '../services/service'
import {config} from '../../config'

// ❌ Avoid absolute paths unless configured
import {helper} from 'src/utils/helper'  // May break

// ✅ OK with path aliasing configured
import {helper} from '@utils/helper'  // If tsconfig has paths
```

### Circular Dependencies

```typescript
// ❌ AVOID circular imports
// FileA.ts
import {functionB} from './FileB'
export const functionA = () => functionB()

// FileB.ts
import {functionA} from './FileA'  // Circular!
export const functionB = () => functionA()

// ✅ SOLUTION: Extract shared logic
// shared.ts
export const sharedFunction = () => {}

// FileA.ts & FileB.ts
import {sharedFunction} from './shared'
```

## ES Modules vs CommonJS

### Always Use ES Modules

```typescript
// ✅ ES Modules (ESM)
import {readFile} from 'fs/promises'
export const myFunction = () => {}
export default MyClass

// ❌ CommonJS (CJS)
const {readFile} = require('fs/promises')
module.exports.myFunction = () => {}
module.exports = MyClass
```

### Why ES Modules?

1. **Static analysis** - Tools can analyze imports at build time
2. **Tree shaking** - Unused exports can be eliminated
3. **Type safety** - Better TypeScript integration
4. **Future proof** - ES modules are the standard
5. **Consistency** - Same syntax for browser and Node.js

## Import Organization Benefits

1. **Predictable structure** - Easy to find imports
2. **Fewer merge conflicts** - Consistent ordering
3. **Clear dependencies** - Grouped by type
4. **Quick identification** - AWS vs vendor vs local
5. **IDE support** - Auto-import follows pattern

## Enforcement

### ESLint Configuration

```json
{
  "rules": {
    "import/order": [
      "error",
      {
        "groups": [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index"
        ],
        "newlines-between": "always",
        "alphabetize": {
          "order": "asc"
        }
      }
    ],
    "import/no-commonjs": "error",
    "import/no-duplicates": "error",
    "@typescript-eslint/consistent-type-imports": "error"
  }
}
```

### Prettier Import Sorting

```json
{
  "importOrder": [
    "^aws-lambda",
    "^../../../lib/vendor/",
    "^../../../types/",
    "^../../../util/",
    "^[./]",
    "^node:"
  ],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true
}
```

### Manual Review Checklist

- [ ] ES modules syntax used (import/export)
- [ ] Imports follow strict order
- [ ] Blank lines between groups
- [ ] Destructured where possible
- [ ] Type imports use `import type`
- [ ] No direct AWS SDK imports
- [ ] No circular dependencies

## Migration Guide

### Converting CommonJS to ESM

1. **Update package.json**
```json
{
  "type": "module"
}
```

2. **Convert requires to imports**
```typescript
// Before
const express = require('express')
const {readFile} = require('fs/promises')

// After
import express from 'express'
import {readFile} from 'fs/promises'
```

3. **Convert module.exports**
```typescript
// Before
module.exports = MyClass
module.exports.helper = helperFunction

// After
export default MyClass
export {helperFunction as helper}
```

4. **Update file extensions** (if needed)
- `.js` → `.mjs` for ES modules
- Or set `"type": "module"` in package.json

## Common Patterns

### Barrel Exports

```typescript
// utils/index.ts (barrel file)
export * from './logger'
export * from './validators'
export * from './formatters'

// Usage
import {logger, validateEmail, formatDate} from './utils'
```

### Re-exports

```typescript
// Aggregate and re-export
export {UserService} from './UserService'
export {ProductService} from './ProductService'
export type {ServiceConfig} from './types'
```

### Dynamic Imports

```typescript
// For code splitting or conditional loading
const module = await import('./heavyModule')

// Conditional import
if (process.env.NODE_ENV === 'development') {
  const {DevTools} = await import('./devTools')
}
```

## Related Patterns

- [Naming Conventions](Naming-Conventions.md) - File and module naming
- [AWS SDK Encapsulation](../AWS/SDK-Encapsulation-Policy.md) - Vendor wrapper imports
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Lambda-specific imports
- [Module Best Practices](../TypeScript/Module-Best-Practices.md) - Export patterns

---

*Consistent import organization reduces cognitive load and makes dependencies clear. Follow this pattern strictly for maintainable code.*