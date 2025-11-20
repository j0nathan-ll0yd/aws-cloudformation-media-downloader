# X-Ray Testing: Explore Better Alternatives to Lazy Initialization

## Problem Statement

AWS X-Ray integration requires importing `aws-xray-sdk-core` in `src/lib/vendor/AWS/clients.ts`. This creates a fundamental conflict with Jest's ESM module mocking system.

**Root Cause:**
When Jest's `unstable_mockModule()` validates module paths, it loads vendor modules → loads `clients.ts` → imports `aws-xray-sdk-core` → fails before any mocks can be applied. This breaks all tests that mock AWS vendor wrappers (14+ test suites).

## Current Solution: Lazy Client Initialization

We implemented lazy initialization in all 7 AWS vendor wrapper files (S3, DynamoDB, SNS, SQS, Lambda, CloudWatch, APIGateway):

```typescript
// Before (breaks Jest)
const client = createS3Client()

export function headObject(params) {
  return client.send(new HeadObjectCommand(params))
}

// After (works)
let client: S3Client | null = null

function getClient(): S3Client {
  if (!client) {
    client = createS3Client()
  }
  return client
}

export function headObject(params) {
  return getClient().send(new HeadObjectCommand(params))
}
```

**Pros:**
- ✅ Works reliably with Jest ESM
- ✅ Better architecture (on-demand client creation)
- ✅ No test file changes needed
- ✅ No runtime overhead (singleton pattern)

**Cons:**
- ❌ Requires changes to all vendor files
- ❌ Slightly more verbose code

## Alternatives Explored

### 1. Jest Manual Mocks (`__mocks__/`)

**Attempt:**
```javascript
// __mocks__/aws-xray-sdk-core.js
module.exports = {
  captureAWSv3Client: (client) => client
}
```

**Why it failed:**
- Manual mocks in `__mocks__/` are NOT automatically used in Jest ESM mode
- Requires `jest.mock()` call to enable
- `jest.mock()` not available in `setupFiles` (runs before test environment)
- `setupFilesAfterEnv` runs too late (after module resolution)

**Status:** ❌ Not possible in Jest 29.x ESM

### 2. `moduleNameMapper` in jest.config.mjs

**Attempt:**
```javascript
moduleNameMapper: {
  '^aws-xray-sdk-core$': '<rootDir>/__mocks__/aws-xray-sdk-core.ts'
}
```

**Why it failed:**
- `moduleNameMapper` doesn't work reliably with `jest.unstable_mockModule`
- Conflicts with ESM dynamic imports
- Still hits module resolution errors

**Status:** ❌ Incompatible with `unstable_mockModule`

### 3. Conditional Import in clients.ts

**Attempts:**
```typescript
// Try 1: Dynamic import
let AWSXRay: any = null
if (process.env.NODE_ENV !== 'test') {
  const module = await import('aws-xray-sdk-core')
  AWSXRay = module.default
}

// Try 2: require() with try/catch
let AWSXRay: any = null
try {
  AWSXRay = require('aws-xray-sdk-core')
} catch (e) {
  // Test environment
}
```

**Why it failed:**
- Top-level `await` causes async module loading issues
- `require()` in ESM still triggers module resolution
- Jest validates module paths before code execution

**Status:** ❌ Module resolution happens before conditional logic

### 4. Per-Test X-Ray Mocks

**Approach:**
Add to every test file that uses vendor wrappers:
```typescript
jest.unstable_mockModule('aws-xray-sdk-core', () => ({
  default: {captureAWSv3Client: <T>(client: T): T => client}
}))
```

**Why we didn't choose it:**
- ✅ Works reliably
- ❌ Requires changes to 14+ test files
- ❌ Repetitive boilerplate
- ❌ Easy to forget in new tests
- ❌ No architectural benefit

**Status:** ⚠️ Viable but inferior to lazy initialization

## Future Considerations

### Jest Upgrades

**Jest 30.1.3** (latest as of 2025-01) fixed `unstable_mockModule` with `node:` prefixed core modules, but this doesn't apply to npm packages like `aws-xray-sdk-core`.

**Monitor for:**
- Improvements to `unstable_mockModule` for npm packages
- Native support for global ESM mocks
- Better module resolution timing

**Action:** Revisit when Jest 31+ is released with ESM improvements.

### Vitest Migration

**Vitest** has superior ESM support with `vi.mock()` that works globally.

**Consider if:**
- Jest ESM support doesn't improve significantly
- We need more test features (benchmarks, browser testing)
- Community momentum shifts to Vitest

**Effort:** Medium (config migration, mock syntax changes)

### Remove X-Ray in Tests

**Approach:** Set `ENABLE_XRAY=false` in all tests and remove import entirely in test builds.

**Why we haven't:**
- Lazy initialization already solves the problem
- Maintaining test vs. production code paths adds complexity
- X-Ray code should be testable

## Recommendation

**Keep lazy initialization unless:**
1. Jest 31+ provides native global ESM mocking
2. We migrate to Vitest
3. Lazy initialization causes production issues (unlikely)

**Review Timeline:** Q2 2026 (after Jest 31+ release)

## Related Files

- `src/lib/vendor/AWS/*.ts` - All vendor wrappers with lazy initialization
- `src/lib/vendor/AWS/clients.ts` - X-Ray import location
- `config/jest.config.mjs` - Jest configuration
- `docs/styleGuides/testStyleGuide.md` - Testing patterns

## References

- Jest ESM docs: https://jestjs.io/docs/ecmascript-modules
- Jest 30.1.3 changelog: https://github.com/jestjs/jest/releases/tag/v30.1.3
- Original issue: AWS X-Ray service maps implementation
