# ESM Migration Guide

## Quick Reference
- **When to use**: Understanding and maintaining ESM compatibility
- **Enforcement**: CRITICAL - Runtime failures if violated
- **Impact if violated**: HIGH - Lambda functions fail at runtime

## Overview

This project uses **pure ESM (ECMAScript Modules)** for AWS Lambda functions running on Node.js 22+. All Lambda bundles are output as `.mjs` files with `format: 'esm'` in esbuild.

However, not all npm packages support ESM natively. This guide documents our approach to maintaining ESM compatibility while using CommonJS (CJS) dependencies.

---

## Current Status (January 2026)

### Migration Completeness: 100%

Production code (`src/`) uses **pure ESM** with zero CommonJS patterns. All Lambda handlers, entity queries, and library code use `import`/`export` syntax exclusively.

| Configuration | Value | Status |
|---------------|-------|--------|
| package.json `type` | `"module"` | ✅ |
| package.json `sideEffects` | `false` | ✅ |
| tsconfig `module` | `"esnext"` | ✅ |
| tsconfig `verbatimModuleSyntax` | `true` | ✅ |
| esbuild `format` | `"esm"` | ✅ |
| Lambda output extension | `.mjs` | ✅ |

### Bundle Size Metrics

All Lambda bundles are well within configured limits:

| Lambda | Size | Status |
|--------|------|--------|
| CloudfrontMiddleware | 48 KB | ✅ Smallest |
| DeviceEvent | 56 KB | ✅ |
| UserSubscribe | 364 KB | ✅ |
| CleanupExpiredRecords | 440 KB | ✅ |
| S3ObjectCreated | 440 KB | ✅ |
| MigrateDSQL | 452 KB | ✅ |
| UserDelete | 544 KB | ✅ |
| ListFiles | 748 KB | ✅ |
| SendPushNotification | 748 KB | ✅ |
| ApiGatewayAuthorizer | 752 KB | ✅ |
| RefreshToken | 752 KB | ✅ |
| RegisterDevice | 756 KB | ✅ |
| WebhookFeedly | 800 KB | ✅ |
| StartFileUpload | 880 KB | ✅ |
| PruneDevices | 1.0 MB | ✅ Includes apns2 |
| LoginUser | 1.3 MB | ✅ Largest |
| RegisterUser | 1.3 MB | ✅ |

### CommonJS Remnants (Justified)

These CommonJS files exist for valid tooling requirements:

| Location | Count | Justification |
|----------|-------|---------------|
| `eslint-local-rules/*.cjs` | 12 files | ESLint plugin architecture requires CommonJS module.exports |
| `.dependency-cruiser.cjs` | 1 file | dependency-cruiser requires CJS configuration format |
| `eslint.config.mjs` (uses `createRequire`) | Bridge | Correct ESM-to-CJS bridge pattern for loading ESLint rules |

**Production code has ZERO CommonJS patterns.**

### Tree-Shaking Verification

- ✅ `treeShaking: true` enabled in esbuild configuration
- ✅ `sideEffects: false` declared in package.json
- ✅ AWS SDK packages externalized (11 packages)
- ✅ Selective barrel exports in `src/entities/queries/index.ts`
- ✅ Proper `mainFields: ['module', 'main']` resolution order
- ✅ ESM export conditions: `['module', 'import']`

### Dynamic Import Usage

The following packages use dynamic imports for ESM compatibility:

| Package | Location | Pattern |
|---------|----------|---------|
| `apns2` | `src/lambdas/PruneDevices/src/index.ts` | `await import('apns2')` |

This is the correct pattern for CJS-only packages used in specific functions.

---

## Architecture Decision: The `createRequire` Shim

### What We Use

```typescript
// config/esbuild.config.ts
const nodeBuiltinRequireShim = `
import { createRequire as __esmCreateRequire } from 'node:module';
const require = __esmCreateRequire(import.meta.url);
`
```

This ~200 byte shim is prepended to every Lambda bundle as a banner.

### Why It's Necessary

When esbuild bundles CommonJS code (like ElectroDB) to ESM format, it generates a compatibility wrapper:

```javascript
var O=(r=>typeof require<"u"?require:...)(function(r){
  if(typeof require<"u")return require.apply(this,arguments);
  throw Error('Dynamic require of "'+r+'" is not supported')
});
```

This wrapper checks if `require` exists at runtime. In Lambda's pure ESM environment, `require` doesn't exist by default, causing runtime errors like:

```
Dynamic require of "@aws-sdk/lib-dynamodb" is not supported
```

The `createRequire` shim provides a `require` function that works in ESM contexts.

### Why Not Patch Instead?

We investigated patching ElectroDB (our primary CJS dependency) similar to our jsonschema patch. The analysis revealed:

| Metric | ElectroDB | jsonschema (patched) |
|--------|-----------|---------------------|
| External requires | 3 | 1 |
| Internal requires | ~100 across 20 files | ~10 |
| Maintenance burden | Fork-equivalent | Minimal |

**Conclusion**: Patching ElectroDB would require converting ~100 `require()` statements across 20+ files - essentially maintaining a fork. The 200-byte shim is the pragmatic solution.

---

## Current Dependency Status

### ESM-Native Packages (No Issues)

| Package | Module Type | Status |
|---------|-------------|--------|
| @aws-sdk/* | Dual ESM+CJS | READY |
| @aws-lambda-powertools/* | Dual ESM+CJS | READY |
| better-auth | Dual ESM+CJS | READY |
| uuid | Dual ESM+CJS | READY |
| zod | Dual ESM+CJS | READY |
| jose | Pure ESM | READY |
| axios | Dual ESM+CJS | READY |
| @opentelemetry/* | Dual ESM+CJS | READY |

### CJS-Only Packages (Require Mitigation)

| Package | Version | Mitigation |
|---------|---------|------------|
| electrodb | 3.5.0 | `createRequire` shim |
| jsonschema | 1.2.7 | pnpm patch (ESM imports) |
| apns2 | 12.2.0 | Dynamic import |

---

## Handling CJS Dependencies

When you encounter a CJS-only dependency, follow this decision tree:

### Step 1: Check if the Package is ESM-Ready

```bash
# Check package.json for ESM indicators
cat node_modules/<package>/package.json | jq '{type, module, exports}'
```

**ESM indicators:**
- `"type": "module"` - Package is ESM-first
- `"exports"` field with `"import"` condition - Dual ESM/CJS support
- `"module"` field - Legacy ESM entry point

If none of these exist, the package is likely CJS-only.

### Step 2: Determine the Impact

| Scenario | Action |
|----------|--------|
| Package is bundled by esbuild | `createRequire` shim handles it automatically |
| Package is externalized | Must use dynamic import or patch |
| Package has Node.js built-in requires | May need pnpm patch |

### Step 3: Choose a Mitigation Strategy

#### Strategy A: Let the Shim Handle It (Default)

For most CJS packages that are bundled, the `createRequire` shim handles everything automatically. No action needed.

**When to use**: The dependency is used throughout the codebase and bundled by esbuild.

#### Strategy B: Dynamic Import

For packages that cause issues or are only used in specific functions:

```typescript
// BEFORE - Static import (causes ESM issues)
import {ApnsClient, Notification} from 'apns2'

// AFTER - Dynamic import inside async function
async function sendNotification(token: string) {
  const {ApnsClient, Notification} = await import('apns2')
  const client = new ApnsClient({...})
  // ... use normally
}
```

**When to use**: Package is only used in one or two places, or causes specific runtime errors.

#### Strategy C: Type-Only Import

If you only need types from a CJS package (no runtime usage):

```typescript
// No runtime code generated - safe for ESM
import type {Notification} from 'apns2'

export class MyError extends Error {
  notification: Notification  // Type annotation only
}
```

**When to use**: Package types are needed but runtime values come from dynamic import elsewhere.

#### Strategy D: pnpm Patch

For packages with specific ESM incompatibilities (like `require('url')`):

```bash
# Create a patch
pnpm patch jsonschema@1.2.7

# Edit files in the temporary directory
# Replace: var uri = require('url');
# With:    import * as uri from 'node:url';

# Commit the patch
pnpm patch-commit /path/to/temp/dir
```

**When to use**: Package has a small, specific CJS pattern that breaks ESM.

**Example**: Our `jsonschema@1.2.7` patch converts `require('url')` to ESM imports:

```diff
// patches/jsonschema@1.2.7.patch
-var uri = require('url');
+import * as uri from 'node:url';
```

#### Strategy E: Find an Alternative Package

If the package is unmaintained or deeply CJS:

| CJS Package | ESM Alternative |
|-------------|-----------------|
| request | axios, node-fetch |
| moment | date-fns, dayjs |
| lodash | lodash-es |

**When to use**: Package is deprecated or migration is straightforward.

---

## Jest Configuration for ESM

Jest requires special configuration to handle ESM and patched packages:

```javascript
// config/jest.config.mjs
{
  // Treat .ts files as ESM
  extensionsToTreatAsEsm: ['.ts'],

  // Use ts-jest with ESM support
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', {useESM: true, tsconfig: '<rootDir>/tsconfig.test.json'}]
  },

  // Transform patched packages (they have ESM syntax in CJS files)
  transformIgnorePatterns: [
    '/node_modules/(?!.*jsonschema.*)'
  ]
}
```

The `transformIgnorePatterns` regex tells Jest to transform `jsonschema` even though it's in `node_modules`, because our patch introduces ESM syntax.

---

## esbuild Configuration

```typescript
// config/esbuild.config.ts
const result = await esbuild.build({
  entryPoints: [entryFile],
  bundle: true,
  platform: 'node',
  target: 'es2022',           // Node.js 22+ supports ES2022
  format: 'esm',              // Output ESM format
  outExtension: {'.js': '.mjs'},  // Explicit .mjs extension
  external: awsSdkExternals,  // Don't bundle AWS SDK (available in Lambda)
  banner: {js: nodeBuiltinRequireShim},  // The createRequire shim

  // ESM-friendly resolution
  mainFields: ['module', 'main'],      // Prefer ESM entry points
  conditions: ['module', 'import'],     // Prefer ESM exports
})
```

### Externalized Packages

AWS SDK packages are externalized (not bundled) because they're available in the Lambda runtime:

```typescript
const awsSdkExternals = [
  '@aws-sdk/client-api-gateway',
  '@aws-sdk/client-cloudwatch',
  '@aws-sdk/client-dynamodb',
  '@aws-sdk/client-lambda',
  '@aws-sdk/client-s3',
  '@aws-sdk/client-sns',
  '@aws-sdk/client-sqs',
  '@aws-sdk/lib-dynamodb',
  '@aws-sdk/lib-storage',
  '@aws-sdk/util-dynamodb'
]
```

These packages are ESM-native, so they work without the shim.

---

## Troubleshooting

### Error: "Dynamic require of X is not supported"

**Cause**: A CJS package is trying to use `require()` at runtime in the ESM bundle.

**Solutions**:
1. Verify the `createRequire` shim is in place (check esbuild banner)
2. If the package is externalized, convert to dynamic import
3. If it's a Node.js built-in, create a pnpm patch

### Error: "Cannot use import statement outside a module"

**Cause**: Jest is trying to run ESM syntax in a CJS context.

**Solutions**:
1. Add the package to `transformIgnorePatterns` regex
2. Ensure `extensionsToTreatAsEsm: ['.ts']` is set
3. Verify ts-jest has `useESM: true`

### Error: "ERR_REQUIRE_ESM"

**Cause**: A CJS file is trying to `require()` a pure ESM package.

**Solutions**:
1. Convert the import to dynamic: `const pkg = await import('esm-pkg')`
2. Find a CJS-compatible version of the package
3. Use a bundler that handles the conversion

---

## Investigating New Dependencies

Before adding a new dependency, check its ESM compatibility:

```bash
# 1. Check package.json indicators
npm info <package> | grep -E "(type|module|exports)"

# 2. Check for ESM entry point
ls node_modules/<package>/*.mjs 2>/dev/null

# 3. Search for require() calls
grep -r "require(" node_modules/<package>/lib/ | head -10

# 4. Check if it's pure ESM (will fail in CJS)
node -e "require('<package>')" 2>&1 | grep -i esm
```

### ESM Compatibility Checklist

- [ ] Package has `"type": "module"` or `"exports"` field
- [ ] No dynamic `require()` calls with variables
- [ ] No `require()` of Node.js built-ins without polyfills
- [ ] Works in Lambda ESM environment (test with `pnpm build && deploy`)

---

## DynamoDB ORM Comparison (For Future Reference)

If ElectroDB ever needs replacement, here's the ESM landscape:

| ORM | Native ESM | Type Safety | Recommendation |
|-----|------------|-------------|----------------|
| ElectroDB (current) | NO | Best | Keep with shim |
| DynamoDB-Toolbox | YES | Excellent | Best ESM alternative |
| DynamoDB OneTable | YES | Strong | Viable alternative |
| TypeDORM | Partial | Strong | Not recommended |
| Dynamoose | NO | Beta | Not recommended |

**Migration effort to DynamoDB-Toolbox**: HIGH (all entities + Lambdas)

---

## Summary

| Situation | Solution |
|-----------|----------|
| CJS package bundled by esbuild | `createRequire` shim (automatic) |
| CJS package with Node.js built-in requires | pnpm patch |
| CJS package used in few places | Dynamic import |
| CJS package types only | `import type` |
| Pure ESM package | No action needed |

**The `createRequire` shim is NOT a hack - it's the correct, Node.js-blessed solution for using CJS dependencies in ESM contexts.**

---

## Related Documentation

- [Module Best Practices](Module-Best-Practices.md)
- [Lambda Function Patterns](Lambda-Function-Patterns.md)
- [esbuild Configuration](../../config/esbuild.config.ts)

---

*Pure ESM with pragmatic CJS compatibility. The shim stays until ElectroDB supports ESM natively.*
