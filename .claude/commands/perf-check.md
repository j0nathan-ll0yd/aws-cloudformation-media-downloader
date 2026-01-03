# Performance Check

Analyze Lambda bundle sizes, estimate cold starts, and identify optimization opportunities.

## Quick Start

```bash
# Usage: /perf-check
# Or for specific Lambda: /perf-check ListFiles
```

## Workflow

### Step 1: Analyze Bundle Sizes

```
MCP Tool: analyze_bundle_size
Query: summary
```

Returns bundle size for all Lambdas.

### Step 2: Detailed Breakdown

For specific Lambda:

```
MCP Tool: analyze_bundle_size
Query: breakdown
Lambda: [name]
```

Shows:
- Total bundle size
- Top dependencies by size
- Tree-shaking effectiveness

### Step 3: Estimate Cold Starts

```
MCP Tool: analyze_cold_start
Query: estimate
Lambda: [name]
```

Estimates cold start time based on:
- Bundle size
- Import depth
- Memory configuration

### Step 4: Compare Configurations

```
MCP Tool: analyze_cold_start
Query: compare
Lambda: [name]
Memory: [256, 512, 1024, 2048]
```

Shows cold start estimates at different memory levels.

### Step 5: Get Optimization Suggestions

```
MCP Tool: analyze_bundle_size
Query: optimize
Lambda: [name]
```

Returns actionable optimization recommendations.

---

## Output Format

```markdown
## Performance Analysis Report

### Bundle Size Summary

| Lambda | Size | Status | Change |
|--------|------|--------|--------|
| ListFiles | 245 KB | OK | -5 KB |
| LoginUser | 312 KB | OK | +2 KB |
| StartFileUpload | 1.2 MB | WARN | +50 KB |
| WebhookFeedly | 890 KB | OK | 0 |

**Total**: 4.2 MB across 18 Lambdas

### Cold Start Estimates

| Lambda | Memory | Est. Cold Start | Status |
|--------|--------|-----------------|--------|
| ListFiles | 256 MB | ~450ms | OK |
| LoginUser | 512 MB | ~380ms | OK |
| StartFileUpload | 1024 MB | ~1200ms | WARN |

### Size Regression Alert

**StartFileUpload** increased by 50 KB (4.3%)

Top contributors:
1. `@aws-sdk/client-s3`: +30 KB
2. `axios`: +15 KB
3. `uuid`: +5 KB

### Optimization Recommendations

#### StartFileUpload (HIGH priority)

1. **Lazy load S3 client** (Est. -200ms cold start)
   ```typescript
   // Instead of top-level import
   const getS3 = () => import('#lib/vendor/AWS/S3');
   ```

2. **Tree-shake unused SDK commands** (Est. -100 KB)
   ```typescript
   // Use specific imports
   import { PutObjectCommand } from '@aws-sdk/client-s3';
   ```

3. **Consider Lambda layers** for shared dependencies

#### General Recommendations

- [ ] Audit dependencies with `pnpm why [package]`
- [ ] Remove unused dev dependencies from bundle
- [ ] Consider esbuild bundle analysis

### Memory Configuration Comparison

For **StartFileUpload**:

| Memory | Cold Start | Cost/Invocation | Recommendation |
|--------|------------|-----------------|----------------|
| 256 MB | ~2100ms | $0.000004 | Too slow |
| 512 MB | ~1400ms | $0.000008 | Acceptable |
| 1024 MB | ~900ms | $0.000017 | Recommended |
| 2048 MB | ~650ms | $0.000033 | Overkill |

**Recommendation**: 1024 MB provides best cost/performance balance
```

---

## Human Checkpoints

1. **Review regression alerts** - Investigate size increases
2. **Approve memory changes** - Before updating Terraform
3. **Validate optimizations** - After applying changes

---

## Threshold Configuration

Default thresholds (configurable):

| Metric | Warning | Critical |
|--------|---------|----------|
| Bundle size | 500 KB | 1 MB |
| Cold start | 1000ms | 2000ms |
| Size increase | 10% | 25% |

---

## Optimization Patterns

### Lazy Loading

```typescript
// Before
import { getS3Client } from '#lib/vendor/AWS/S3';

// After
let s3Client: S3Client | null = null;
const getS3 = async () => {
  if (!s3Client) {
    const { getS3Client } = await import('#lib/vendor/AWS/S3');
    s3Client = getS3Client();
  }
  return s3Client;
};
```

### Selective Imports

```typescript
// Before
import * as AWS from '@aws-sdk/client-s3';

// After
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
```

### External Dependencies

Update `esbuild.config.ts` to externalize large dependencies:

```typescript
external: ['@aws-sdk/*', 'aws-lambda']
```

---

## Integration

Run as part of CI:

```yaml
- name: Performance Check
  run: |
    pnpm run build
    # Compare bundle sizes against baseline
```

---

## Notes

- Run after significant dependency changes
- Monitor trends over time
- Balance bundle size vs. cold start
- Consider Lambda layers for shared code
