# Lambda Bundle Size Analysis

This document provides a comprehensive analysis of Lambda function bundle sizes, identifies heavy dependencies, evaluates tree-shaking effectiveness, and provides optimization recommendations.

**Generated**: 2026-01-02

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Lambdas | 17 |
| Total Bundle Size | 10.86 MB |
| Average Bundle Size | 639 KB |
| Largest Bundle | RegisterUser (1.27 MB) |
| Smallest Bundle | CloudfrontMiddleware (43 KB) |
| Bundles at Warning Threshold | 1 (PruneDevices at 98.4%) |

## Bundle Size Breakdown

### By Size (Descending)

| Lambda | Size | Limit | Usage | Status |
|--------|------|-------|-------|--------|
| RegisterUser | 1.27 MB | 2.00 MB | 62.0% | OK |
| LoginUser | 1.26 MB | 2.00 MB | 61.7% | OK |
| PruneDevices | 1007 KB | 1.00 MB | 98.4% | WARNING |
| StartFileUpload | 859 KB | 3.00 MB | 28.0% | OK |
| WebhookFeedly | 781 KB | 2.00 MB | 38.1% | OK |
| RegisterDevice | 738 KB | 1.00 MB | 72.1% | OK |
| RefreshToken | 735 KB | 1.00 MB | 71.7% | OK |
| ApiGatewayAuthorizer | 733 KB | 1.00 MB | 71.6% | OK |
| ListFiles | 729 KB | 1.00 MB | 71.2% | OK |
| SendPushNotification | 729 KB | 1.00 MB | 71.1% | OK |
| UserDelete | 538 KB | 1.00 MB | 52.5% | OK |
| S3ObjectCreated | 434 KB | 1.00 MB | 42.4% | OK |
| MigrateDSQL | 434 KB | 2.00 MB | 21.2% | OK |
| CleanupExpiredRecords | 433 KB | 1.00 MB | 42.3% | OK |
| UserSubscribe | 346 KB | 1.00 MB | 33.8% | OK |
| DeviceEvent | 50 KB | 1.00 MB | 4.9% | OK |
| CloudfrontMiddleware | 43 KB | 512 KB | 8.4% | OK |

### By Category

**Authentication Lambdas** (Use Better Auth)
- RegisterUser: 1.27 MB
- LoginUser: 1.26 MB
- RefreshToken: 735 KB
- ApiGatewayAuthorizer: 733 KB

**Database Lambdas** (Use Drizzle ORM)
- PruneDevices: 1007 KB
- RegisterDevice: 738 KB
- ListFiles: 729 KB
- UserDelete: 538 KB
- S3ObjectCreated: 434 KB
- CleanupExpiredRecords: 433 KB

**Event Processing Lambdas**
- StartFileUpload: 859 KB
- WebhookFeedly: 781 KB
- SendPushNotification: 729 KB

**Lightweight Lambdas** (< 100 KB)
- DeviceEvent: 50 KB
- CloudfrontMiddleware: 43 KB

## Heavy Dependencies Analysis

### 1. Better Auth (Largest Impact)

**Affected Lambdas**: RegisterUser, LoginUser, RefreshToken, ApiGatewayAuthorizer

**Bundle Impact**: ~800 KB per Lambda

| Component | Size | Notes |
|-----------|------|-------|
| social-providers/index.mjs | 48 KB | ALL OAuth providers bundled (Google, GitHub, Facebook, Discord, etc.) even though only Apple Sign In is used |
| Kysely query builder | 42 KB | Pulled in as better-auth dependency, not used directly |
| better-call framework | 10+ KB | HTTP middleware |
| lodash.merge | 51 KB | Configuration merging |

**Root Cause**: Better Auth bundles all OAuth providers regardless of which ones are configured.

**Recommendation**: Monitor better-auth releases for improved tree-shaking. Consider filing an issue upstream requesting provider-level code splitting.

### 2. Zod v4 (Moderate Impact)

**Affected Lambdas**: All validation-heavy Lambdas

**Bundle Impact**: ~48 KB per Lambda

| Component | Size | Notes |
|-----------|------|-------|
| zod/v4/core/schemas.js | 28 KB | Core validation logic |
| zod/v4/classic/schemas.js | 20 KB | Classic API compatibility |

**Root Cause**: Zod v4 ships dual distribution (core + classic) and both are bundled due to how exports are structured.

**Recommendation**: No action needed currently. Zod is essential for runtime validation.

### 3. Undici HTTP Client (PruneDevices)

**Affected Lambdas**: PruneDevices (primary), others via apns2

**Bundle Impact**: ~141 KB

| Component | Size | Notes |
|-----------|------|-------|
| llhttp-simd-wasm.js | 71 KB | WASM HTTP parser |
| llhttp-wasm.js | 71 KB | Fallback HTTP parser |

**Root Cause**: apns2 library uses undici for HTTP/2 support to Apple Push Notification service.

**Recommendation**: Already using dynamic import for apns2 in PruneDevices. No further optimization available without switching APNS libraries.

### 4. PostgreSQL Driver

**Affected Lambdas**: All database Lambdas

**Bundle Impact**: ~14 KB per Lambda

| Component | Size | Notes |
|-----------|------|-------|
| postgres/src/connection.js | 14 KB | Connection handling |

**Root Cause**: Required for Aurora DSQL connectivity.

**Recommendation**: No action needed. This is essential infrastructure.

### 5. Drizzle ORM

**Affected Lambdas**: All database Lambdas

**Bundle Impact**: ~30 KB per Lambda

| Component | Size | Notes |
|-----------|------|-------|
| drizzle-orm/pg-core/dialect.js | 11 KB | PostgreSQL dialect |
| drizzle-orm query builders | 19 KB | Query construction |

**Root Cause**: Required for type-safe database access.

**Recommendation**: No action needed. Drizzle is well-optimized.

## Tree-Shaking Effectiveness

### What's Working Well

1. **AWS SDK v3 Externalization**: All AWS SDK packages correctly externalized via esbuild config. Saves ~500 KB per Lambda.

2. **ESM Format**: Bundles use ESM (`format: 'esm'`) enabling better tree-shaking than CommonJS.

3. **sideEffects: false**: Declared in package.json, allowing bundler to eliminate unused exports.

4. **Module-First Resolution**: esbuild configured with `mainFields: ['module', 'main']` and `conditions: ['module', 'import']` to prefer ESM.

5. **Vendor Wrapper Pattern**: AWS SDK calls go through `#lib/vendor/AWS/` wrappers, enabling clean encapsulation.

6. **Specific Submodule Imports**: Production code imports from specific submodules (`#lib/vendor/Drizzle/schema`) rather than barrel files.

### Tree-Shaking Barriers

1. **Better Auth Social Providers**: All OAuth providers bundled regardless of configuration. This is an upstream library issue.

2. **Zod Dual Distribution**: Both classic and core exports included due to package structure.

3. **WASM Modules**: undici's WASM HTTP parsers cannot be tree-shaken.

### Barrel File Analysis

The Drizzle vendor module uses `export *` in its barrel file (`src/lib/vendor/Drizzle/index.ts`):

```typescript
export * from './schema'
export * from './types'
export * from './type-utils'
export * from './fk-enforcement'
export * from './zod-schemas'
```

**Finding**: Production code already imports from specific submodules rather than the barrel file. Tree-shaking is already effective at the module level.

## Configuration Analysis

### esbuild Configuration

**File**: `config/esbuild.config.ts`

```typescript
const awsSdkExternals = [
  '@aws-sdk/client-api-gateway',
  '@aws-sdk/client-cloudwatch',
  '@aws-sdk/client-dynamodb',
  '@aws-sdk/client-eventbridge',
  '@aws-sdk/client-lambda',
  '@aws-sdk/client-s3',
  '@aws-sdk/client-sns',
  '@aws-sdk/client-sqs',
  '@aws-sdk/lib-dynamodb',
  '@aws-sdk/lib-storage',
  '@aws-sdk/util-dynamodb'
]

await esbuild.build({
  bundle: true,
  platform: 'node',
  target: 'es2022',
  format: 'esm',
  external: awsSdkExternals,
  minify: true,
  treeShaking: true,
  mainFields: ['module', 'main'],
  conditions: ['module', 'import']
})
```

**Assessment**: Configuration is well-optimized. No improvements available at the esbuild level.

### Bundle Limits Configuration

**File**: `config/bundle-limits.json`

Limits are appropriately set based on Lambda functionality:
- Authentication Lambdas: 2 MB (accounts for better-auth overhead)
- Database Lambdas: 1 MB
- StartFileUpload: 3 MB (accounts for yt-dlp integration)

## Optimization Recommendations

### Short Term (No Code Changes)

1. **Monitor PruneDevices**: At 98.4% of limit, any dependency update could cause CI failure. Consider increasing limit to 1.5 MB proactively.

2. **Run Bundle Analysis Regularly**: Use `pnpm run analyze` after major dependency updates to catch regressions.

### Medium Term (Low Risk)

1. **API Schema Generator**: The auto-generated `src/types/api-schema/index.ts` uses `export *`. Modify generator to produce named exports for better tree-shaking.

2. **Lazy Load apns2**: Already implemented in PruneDevices. Verify pattern in other Lambdas that use APNS.

### Long Term (Architectural)

1. **Lambda Layers**: Consider extracting common dependencies (Drizzle, Zod, Powertools) into a shared Lambda Layer. This would:
   - Reduce individual bundle sizes
   - Share cold-start cost across invocations
   - Require careful versioning

2. **Better Auth Upgrade**: Monitor for releases with improved provider tree-shaking. Current version bundles all OAuth providers regardless of configuration.

3. **Database Connection Pooling**: If cold starts become an issue, consider RDS Proxy or connection pooling Lambda extension.

## CI/CD Integration

### Bundle Size Checks

Bundle sizes are validated in CI via `pnpm run check:bundle-size`:

```bash
# In GitHub Actions workflow
- name: Check bundle sizes
  run: pnpm run check:bundle-size
```

### Warning Threshold

Bundles exceeding 90% of their limit trigger warnings but don't fail CI. This provides early warning before limits are exceeded.

### Manual Analysis

Generate detailed bundle reports:

```bash
# Generate metafiles and HTML report
ANALYZE=true pnpm run build
pnpm run analyze

# Open interactive report
open build/reports/bundle-analysis.html
```

## References

- esbuild config: `config/esbuild.config.ts`
- Bundle limits: `config/bundle-limits.json`
- Visualization script: `scripts/visualize-bundles.ts`
- Bundle check script: `scripts/check-bundle-size.ts`
- MCP analysis tools: `pnpm run mcp:server` then use `analyze_bundle_size` tool
