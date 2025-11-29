# Prettier to dprint Migration Guide

This guide provides step-by-step instructions for migrating from Prettier to dprint in this project.

## Why dprint?

Based on the evaluation in `PRETTIER-ALTERNATIVES-EVALUATION.md`, dprint is recommended if you need:

- ✅ Maximum control over object type formatting
- ✅ Maximum control over method chaining
- ✅ 10-30x faster than Prettier
- ✅ Highly configurable without ESLint complexity
- ✅ Can coexist with Prettier via plugin

**Trade-off**: More configuration effort than Biome, smaller ecosystem.

## Prerequisites

- Node.js 22.18.0 (already in use)
- pnpm 10.0.0 (already in use)
- Commit or stash any pending changes

## Migration Steps

### Phase 1: Install and Configure dprint

#### 1.1 Install dprint

```bash
cd /home/runner/work/aws-cloudformation-media-downloader/aws-cloudformation-media-downloader
pnpm add -D dprint
```

#### 1.2 Verify Installation

```bash
pnpm dprint --version
```

#### 1.3 Configure dprint

The `dprint.json` configuration file has already been created. Review it:

```bash
cat dprint.json
```

Key configuration points addressing the issues:
- `lineWidth: 250` - Matches Prettier
- `memberExpression.linePerExpression: true` - Forces method chains to break
- `objectExpression.preferSingleLine: false` - Keeps object types multi-line
- `preferSingleLine: false` - Global preference for multi-line
- `semiColons: "asi"` - Matches Prettier `semi: false`
- `quoteStyle: "preferSingle"` - Matches Prettier
- `trailingCommas: "never"` - Matches Prettier

### Phase 2: Test dprint on Sample Files

#### 2.1 Format a Single File

Test dprint on a simple file first:

```bash
# Check what would change (dry run)
pnpm dprint check src/entities/Files.ts

# Actually format the file
pnpm dprint fmt src/entities/Files.ts
```

#### 2.2 Compare with Prettier

```bash
# Save current state
git stash

# Format with Prettier (current)
pnpm prettier --write src/entities/Files.ts
git add src/entities/Files.ts
git stash

# Format with dprint
pnpm dprint fmt src/entities/Files.ts

# Compare
git diff src/entities/Files.ts

# View both versions
git stash show -p stash@{0}  # Prettier version
git diff                      # dprint version
```

#### 2.3 Test on Method Chaining

Test specifically on code with method chains:

```bash
# Create test file to see method chain formatting
cat > /tmp/test-chain.ts << 'EOF'
const result = await UserFiles.query.byUser({userId}).go()

const response = await Files.get(fileKeys).go({concurrency: 5})

const data = someObject.method1().method2().method3()
EOF

# Format with dprint
pnpm dprint fmt /tmp/test-chain.ts

# View result
cat /tmp/test-chain.ts
```

Expected output with `memberExpression.linePerExpression: true`:

```typescript
const result = await UserFiles.query
  .byUser({userId})
  .go()

const response = await Files
  .get(fileKeys)
  .go({concurrency: 5})

const data = someObject
  .method1()
  .method2()
  .method3()
```

#### 2.4 Test on Object Types

Test on inline object types:

```bash
cat > /tmp/test-object.ts << 'EOF'
interface TestType {prop1: string; prop2: number; prop3: boolean}
EOF

pnpm dprint fmt /tmp/test-object.ts
cat /tmp/test-object.ts
```

Expected output with `objectExpression.preferSingleLine: false`:

```typescript
interface TestType {
  prop1: string
  prop2: number
  prop3: boolean
}
```

### Phase 3: Update Package Scripts

#### 3.1 Add dprint Scripts

Add dprint scripts alongside Prettier (parallel operation phase):

```json
{
  "scripts": {
    "format": "prettier --write 'src/**/*.{ts,js,json}' 'config/**/*.{ts,js,json}'",
    "format:dprint": "dprint fmt",
    "format:check:dprint": "dprint check",
    "lint": "eslint -c ./eslint.config.mjs ."
  }
}
```

### Phase 4: Test on Full Codebase

#### 4.1 Check What Would Change

```bash
# Dry run - see all files that would change
pnpm dprint check

# More verbose output
pnpm dprint check --verbose
```

#### 4.2 Format All Files

```bash
# Format everything
pnpm dprint fmt

# Review git diff
git status
git diff --stat

# Review specific changes
git diff src/lambdas/WebhookFeedly/src/index.ts
git diff src/entities/
git diff src/util/lambda-helpers.ts
```

#### 4.3 Evaluate Method Chain Changes

Look specifically at ElectroDB usage patterns:

```bash
# Find all ElectroDB query chains
git diff | grep -A 5 "\.query\."
git diff | grep -A 5 "\.get("
git diff | grep -A 5 "\.create("
git diff | grep -A 5 "\.update("
```

Example before (Prettier):
```typescript
const userFilesResponse = await UserFiles.query.byUser({userId}).go()
```

Example after (dprint with `linePerExpression: true`):
```typescript
const userFilesResponse = await UserFiles.query
  .byUser({userId})
  .go()
```

**Decision Point**: Do you prefer the multi-line method chains?

If **YES**: Continue with dprint  
If **NO**: Consider adjusting `memberExpression.linePerExpression: false` or use Biome instead

#### 4.4 Run Tests

```bash
# Ensure formatting didn't break anything
pnpm run test

# If tests fail:
# - Check for broken string literals
# - Check for broken template strings
# - Check test fixture expectations
```

#### 4.5 Run Type Checking

```bash
pnpm run check-types
```

#### 4.6 Run Build

```bash
pnpm run build
```

### Phase 5: Fine-Tune Configuration

Based on the results, you may want to adjust settings.

#### 5.1 Adjust Method Chain Breaking

If method chains are too aggressive:

```json
{
  "typescript": {
    "memberExpression.linePerExpression": false,
    "callExpression.preferSingleLine": true
  }
}
```

Or use conditional breaking (only break long chains):

```json
{
  "typescript": {
    "memberExpression.linePerExpression": false,
    "preferHanging": true
  }
}
```

#### 5.2 Adjust Object Formatting

If objects are breaking too much:

```json
{
  "typescript": {
    "objectExpression.preferSingleLine": true,
    "typeLiteral.preferSingleLine": true
  }
}
```

#### 5.3 Adjust Import Breaking

If imports are formatting unexpectedly:

```json
{
  "typescript": {
    "importDeclaration.preferSingleLine": false,
    "exportDeclaration.preferSingleLine": false
  }
}
```

#### 5.4 Re-test After Adjustments

```bash
# Format again with new config
pnpm dprint fmt

# Review changes
git diff
```

### Phase 6: Update IDE Configuration

#### 6.1 VS Code Settings

Create or update `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "dprint.dprint",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.defaultFormatter": "dprint.dprint"
  },
  "[javascript]": {
    "editor.defaultFormatter": "dprint.dprint"
  },
  "[json]": {
    "editor.defaultFormatter": "dprint.dprint"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "dprint.dprint"
  },
  "[markdown]": {
    "editor.defaultFormatter": "dprint.dprint"
  }
}
```

#### 6.2 Install VS Code Extension

```bash
code --install-extension dprint.dprint
```

Or search for "dprint" in VS Code extensions marketplace.

### Phase 7: Update CI/CD

#### 7.1 Update GitHub Actions

Update `.github/workflows/unit-tests.yml`:

```yaml
- name: Format check
  run: pnpm dprint check
```

#### 7.2 Update Pre-commit Hooks

If using husky:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "pnpm dprint fmt"
    }
  }
}
```

### Phase 8: Remove Prettier

#### 8.1 Update package.json Scripts

Replace Prettier scripts:

```json
{
  "scripts": {
    "format": "dprint fmt",
    "format:check": "dprint check"
  }
}
```

#### 8.2 Remove Prettier Dependencies

```bash
pnpm remove prettier eslint-config-prettier eslint-plugin-prettier
```

#### 8.3 Remove Prettier Config

```bash
rm .prettierrc
```

#### 8.4 Remove Prettier from ESLint

Update `eslint.config.mjs`:

```javascript
export default [
  {
    ignores: [/* ... */]
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended'
    // REMOVED: 'plugin:prettier/recommended'
  ),
  // ... rest
]
```

### Phase 9: Update Documentation

#### 9.1 Update AGENTS.md

```markdown
## Code Style Requirements
- **ALWAYS** format code with dprint: `pnpm run format`
- dprint configuration: `dprint.json` (250 char lines, method chain breaking enabled)
```

#### 9.2 Update README.md

```markdown
### Essential Commands
```bash
pnpm run format       # Format with dprint
pnpm run format:check # Check formatting
```
```

#### 9.3 Create Convention Document

Update `docs/conventions-tracking.md`:

```markdown
### Detected: 2025-11-29

1. **dprint Formatter Migration** (Convention)
   - **What**: Migrated from Prettier to dprint for fine-grained formatting control
   - **Why**: Better control over method chains and object types, 10-30x faster
   - **Config**: `memberExpression.linePerExpression: true` for ElectroDB patterns
   - **Detected**: During formatter evaluation
   - **Status**: ✅ Documented
```

### Phase 10: Verification

#### 10.1 Complete Build Pipeline

```bash
rm -rf build/ dist/ .webpackCache/
pnpm run precheck
pnpm run build
pnpm test
```

#### 10.2 Verify CI

```bash
git add -A
git commit -m "feat: migrate from Prettier to dprint formatter"
git push
```

#### 10.3 Manual Code Review

Review key files manually to ensure readability:

- ElectroDB entity definitions
- Lambda handlers
- Complex utility functions
- Test files

## Advanced Configuration

### Selective Configuration by File Type

dprint supports overrides for specific patterns:

```json
{
  "typescript": {
    "lineWidth": 250
  },
  "overrides": [
    {
      "includes": ["**/*.test.ts"],
      "typescript": {
        "preferSingleLine": true
      }
    }
  ]
}
```

### Using Prettier Plugin for Fallback

If some files need Prettier:

```json
{
  "plugins": [
    "https://plugins.dprint.dev/typescript-0.93.0.wasm",
    "https://plugins.dprint.dev/prettier-0.46.1.json@e5bf2f682d01c5bc784c70fe44bde885c0164608d0fce89fe1672ed16d38b47b"
  ]
}
```

### Configuration for This Project's Patterns

Optimized for ElectroDB and Lambda patterns:

```json
{
  "typescript": {
    "lineWidth": 250,
    "memberExpression.linePerExpression": true,
    "objectExpression.preferSingleLine": false,
    "arrowFunction.useParentheses": "force",
    "preferHanging": false,
    "exportDeclaration.preferSingleLine": false,
    "importDeclaration.preferSingleLine": false
  }
}
```

## Troubleshooting

### Issue: Too Many Line Breaks

**Solution**: Adjust `preferSingleLine` settings:

```json
{
  "typescript": {
    "memberExpression.linePerExpression": false,
    "callExpression.preferSingleLine": true
  }
}
```

### Issue: Inconsistent with Team Preferences

**Solution**: This is the main risk with fine-grained control. Consider:
1. Team discussion on preferences
2. Document decisions in conventions
3. Use `// dprint-ignore` for exceptions
4. Or revert to Biome for more opinionated formatting

### Issue: Slow in CI

**Solution**: dprint is already fast, but ensure:
- Using latest version
- Proper excludes configured
- Not running on node_modules

### Issue: VS Code Not Using dprint

**Solution**:
- Install dprint extension
- Check `.vscode/settings.json`
- Reload VS Code
- Check dprint extension output

## Rollback Plan

```bash
# Reinstall Prettier
pnpm add -D prettier eslint-config-prettier eslint-plugin-prettier

# Restore configs
git checkout main -- .prettierrc package.json

# Format with Prettier
pnpm prettier --write 'src/**/*.{ts,js,json}'

# Remove dprint
pnpm remove dprint
rm dprint.json
```

## Success Criteria

✅ Method chains break per expression (or as configured)  
✅ Object types stay multi-line  
✅ All tests pass  
✅ TypeScript compiles  
✅ Build succeeds  
✅ CI passes  
✅ Code readability improved  

## Comparison: Before and After

### Before (Prettier)
```typescript
const response = await Files.get(fileKeys).go({concurrency: 5, attributes: ['fileId', 'key']})

interface Device {name: string; token: string; systemVersion: string; deviceId: string}
```

### After (dprint with recommended config)
```typescript
const response = await Files
  .get(fileKeys)
  .go({
    concurrency: 5,
    attributes: ['fileId', 'key']
  })

interface Device {
  name: string
  token: string
  systemVersion: string
  deviceId: string
}
```

**Evaluate**: Is this better for your team's readability?

## Next Steps

1. Monitor for issues over 1-2 weeks
2. Gather team feedback
3. Adjust configuration based on feedback
4. Document any `// dprint-ignore` patterns
5. Update this guide with lessons learned

## References

- dprint Documentation: https://dprint.dev/
- TypeScript Plugin: https://dprint.dev/plugins/typescript/
- Configuration: https://dprint.dev/plugins/typescript/config/
- VS Code Extension: https://marketplace.visualstudio.com/items?itemName=dprint.dprint
