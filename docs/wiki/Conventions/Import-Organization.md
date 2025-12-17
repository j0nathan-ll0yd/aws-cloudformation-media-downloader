# Import Organization

## Quick Reference
- **When to use**: Organizing imports in any TypeScript/JavaScript file
- **Enforcement**: Required - consistent imports improve readability
- **Impact if violated**: Medium - confusion and merge conflicts

## The Rule

### Module System
**Use ES modules (import/export), not CommonJS (require)**

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

// 2. Vendor library imports (lib/vendor/*)
import {query, updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {createS3Upload, headObject} from '../../../lib/vendor/AWS/S3'

// 3. Type imports (types/*)
import type {FileRecord} from '../../../types/persistence-types'
import type {User} from '../../../types/domain-models'
import type {FileStatus} from '../../../types/enums'

// 4. Utility imports (util/*)
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {UnexpectedError} from '../../../util/errors'

// 5. Local imports
import {processFile} from './fileProcessor'

// 6. Node built-ins (if needed)
import * as path from 'path'
```

### ❌ Incorrect

```typescript
// ❌ WRONG - Mixed order, no grouping
import * as fs from 'fs'  // Built-ins should be last
import {UserService} from './services/UserService'
import {APIGatewayProxyResult} from 'aws-lambda'  // Lambda types should be first
import {logger} from './utils/logger'
import type {UserData} from './types'  // Types before utils

// ❌ WRONG - CommonJS syntax
const express = require('express')

// ❌ WRONG - Direct AWS SDK import
import {S3Client} from '@aws-sdk/client-s3'
// Should use vendor wrapper:
import {createS3Upload} from '../../../lib/vendor/AWS/S3'
```

## Import Styles

### Destructured Imports (Preferred)

```typescript
// ✅ GOOD - Destructured, specific
import {logDebug, logInfo, logError} from './logger'
import {validateEmail, validatePhone} from './validators'
```

### Type Imports

```typescript
// ✅ GOOD - Explicit type imports
import type {UserProfile, UserSettings} from './types'
import type {Request, Response} from 'express'
```

## Special Rules

### AWS SDK Imports (FORBIDDEN)

```typescript
// ❌ NEVER import AWS SDK directly
import {S3Client} from '@aws-sdk/client-s3'
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'

// ✅ ALWAYS use vendor wrappers
import {createS3Upload} from '../../../lib/vendor/AWS/S3'
import {query} from '../../../lib/vendor/AWS/DynamoDB'
```

### Avoid Circular Dependencies

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
```

### Why ES Modules?

1. **Static analysis** - Tools analyze imports at build time
2. **Tree shaking** - Unused exports eliminated
3. **Type safety** - Better TypeScript integration
4. **Future proof** - ES modules are the standard

## Enforcement

### Code Review Checklist

- [ ] ES modules syntax used (import/export)
- [ ] Imports follow strict order
- [ ] Blank lines between groups
- [ ] Destructured where possible
- [ ] Type imports use `import type`
- [ ] No direct AWS SDK imports
- [ ] No circular dependencies

## Related Patterns

- [Naming Conventions](Naming-Conventions.md) - File and module naming
- [AWS SDK Encapsulation](../AWS/SDK-Encapsulation-Policy.md) - Vendor wrapper imports
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Lambda-specific imports

---

*Consistent import organization reduces cognitive load and makes dependencies clear. Follow this pattern strictly for maintainable code.*
