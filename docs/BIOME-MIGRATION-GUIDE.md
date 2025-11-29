# Prettier to Biome Migration Guide

This guide provides step-by-step instructions for migrating from Prettier to Biome in this project.

## Why Biome?

Based on the evaluation in `PRETTIER-ALTERNATIVES-EVALUATION.md`, Biome is recommended because:

- ✅ 97% Prettier compatible (minimal breaking changes)
- ✅ 10-35x faster than Prettier
- ✅ Can replace both Prettier AND ESLint
- ✅ Excellent IDE support (VS Code, JetBrains, Neovim)
- ✅ Low migration effort
- ✅ Better configuration than Prettier (though not as granular as dprint)

## Prerequisites

- Node.js 22.18.0 (already in use)
- pnpm 10.0.0 (already in use)
- Commit or stash any pending changes

## Migration Steps

### Phase 1: Install and Configure Biome

#### 1.1 Install Biome

```bash
cd /home/runner/work/aws-cloudformation-media-downloader/aws-cloudformation-media-downloader
pnpm add -D --save-exact @biomejs/biome
```

#### 1.2 Verify Installation

```bash
pnpm biome --version
```

#### 1.3 Configure Biome

The `biome.json` configuration file has already been created. Review it:

```bash
cat biome.json
```

Key configuration points:
- `lineWidth: 250` - Matches Prettier
- `quoteStyle: "single"` - Matches Prettier
- `semicolons: "asNeeded"` - Matches Prettier `semi: false`
- `trailingCommas: "none"` - Matches Prettier
- `bracketSpacing: false` - Matches Prettier

### Phase 2: Test Biome on Sample Files

#### 2.1 Format a Single File

Test Biome on a simple file first:

```bash
# Check what would change (dry run)
pnpm biome format --write=false src/entities/Files.ts

# Actually format the file
pnpm biome format --write src/entities/Files.ts
```

#### 2.2 Compare with Prettier

```bash
# Format with Prettier (current)
pnpm prettier --write src/entities/Files.ts

# Check git diff
git diff src/entities/Files.ts

# Revert if needed
git checkout src/entities/Files.ts

# Format with Biome
pnpm biome format --write src/entities/Files.ts

# Check git diff again
git diff src/entities/Files.ts
```

#### 2.3 Test on a Lambda Function

```bash
# Test on a complete Lambda
pnpm biome format --write src/lambdas/ListFiles/src/index.ts

# Review changes
git diff src/lambdas/ListFiles/src/index.ts
```

### Phase 3: Update Package Scripts

#### 3.1 Backup Current Scripts

```bash
# Document current scripts
grep -A 2 '"format"' package.json
grep -A 2 '"lint"' package.json
```

#### 3.2 Update package.json

Add Biome scripts alongside Prettier (parallel operation phase):

```json
{
  "scripts": {
    "format": "prettier --write 'src/**/*.{ts,js,json}' 'config/**/*.{ts,js,json}'",
    "format:biome": "biome format --write .",
    "format:check": "biome format .",
    "lint": "eslint -c ./eslint.config.mjs .",
    "lint:biome": "biome lint .",
    "check:biome": "biome check --write ."
  }
}
```

Note: `biome check` runs both formatter and linter.

### Phase 4: Test on Full Codebase

#### 4.1 Run Biome Formatter on All Files

```bash
# Dry run to see what would change
pnpm biome format --write=false .

# Review the changes summary
pnpm biome format --write=false . | head -50
```

#### 4.2 Check for Breaking Changes

```bash
# Format everything
pnpm biome format --write .

# Review git diff
git status
git diff --stat

# Review specific files that changed
git diff src/lambdas/
git diff src/entities/
git diff src/util/
```

#### 4.3 Run Tests

```bash
# Ensure formatting didn't break anything
pnpm run test

# If tests fail, investigate:
# - Did formatting change line numbers in error messages?
# - Did formatting break any string literals or templates?
# - Did formatting change test fixture expectations?
```

#### 4.4 Run Type Checking

```bash
# Ensure TypeScript still compiles
pnpm run check-types
```

#### 4.5 Run Build

```bash
# Ensure webpack still builds
pnpm run build
```

### Phase 5: Update IDE Configuration

#### 5.1 VS Code Settings

Create or update `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

#### 5.2 Install VS Code Extension

```bash
# Install Biome VS Code extension
code --install-extension biomejs.biome
```

Or search for "Biome" in VS Code extensions marketplace.

### Phase 6: Update CI/CD

#### 6.1 Update GitHub Actions

Update `.github/workflows/unit-tests.yml`:

```yaml
# Replace Prettier check
- name: Format check
  run: pnpm run format:check
```

Or use Biome's check command:

```yaml
- name: Biome check
  run: pnpm biome check .
```

#### 6.2 Update Pre-commit Hooks (if applicable)

If using husky or similar:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "pnpm biome check --write --no-errors-on-unmatched --files-ignore-unknown=true"
    }
  }
}
```

### Phase 7: Remove Prettier

#### 7.1 Update package.json Scripts

Replace Prettier scripts with Biome:

```json
{
  "scripts": {
    "format": "biome format --write .",
    "format:check": "biome format .",
    "lint": "biome lint .",
    "check": "biome check .",
    "check:write": "biome check --write ."
  }
}
```

#### 7.2 Update precheck Script

```json
{
  "scripts": {
    "precheck": "pnpm run check-types && pnpm run check"
  }
}
```

#### 7.3 Remove Prettier Dependencies

```bash
pnpm remove prettier eslint-config-prettier eslint-plugin-prettier
```

#### 7.4 Remove Prettier Config

```bash
rm .prettierrc
```

#### 7.5 Remove Prettier from ESLint

Update `eslint.config.mjs`:

```javascript
// Remove these lines:
// ...compat.extends('plugin:prettier/recommended'),

// Or if keeping ESLint alongside Biome, just remove Prettier plugin
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
  // ... rest of config
]
```

### Phase 8: Update Documentation

#### 8.1 Update AGENTS.md

Update formatting instructions:

```markdown
## Code Style Requirements
- **ALWAYS** format code with Biome: `pnpm run format`
- Biome configuration: `biome.json` (250 char lines, single quotes, no semis)
```

#### 8.2 Update README.md

Update development workflow section:

```markdown
### Essential Commands
```bash
pnpm run format       # Format with Biome
pnpm run check        # Run Biome checks (format + lint)
pnpm run precheck     # TypeScript and Biome checks
```
```

#### 8.3 Update Contribution Guidelines

If you have `CONTRIBUTING.md`, update formatting instructions.

#### 8.4 Create Convention Document

Update `docs/conventions-tracking.md`:

```markdown
### Detected: 2025-11-29

1. **Biome Formatter Migration** (Convention)
   - **What**: Migrated from Prettier to Biome for faster formatting and better control
   - **Why**: 10-35x performance improvement, better IDE integration, path to ESLint replacement
   - **Detected**: During formatter evaluation for fine-grained control
   - **Target**: docs/wiki/Conventions/Code-Formatting.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented
```

### Phase 9: Verification

#### 9.1 Complete Build Pipeline

Run the full pipeline to ensure everything works:

```bash
# Clean build
rm -rf build/ dist/ .webpackCache/

# Full pipeline
pnpm run precheck    # Types + Biome
pnpm run build       # Webpack build
pnpm test            # Jest tests
```

#### 9.2 Verify CI

Push changes and verify GitHub Actions passes:

```bash
git add -A
git commit -m "feat: migrate from Prettier to Biome formatter"
git push
```

Check GitHub Actions for any failures.

#### 9.3 Test Remote Endpoints (Optional)

If deployed, test remote endpoints to ensure formatting didn't break runtime:

```bash
pnpm run test-remote-list
pnpm run test-remote-hook
```

### Phase 10: Enable Biome Linter (Optional)

Once comfortable with the formatter, consider enabling Biome's linter:

#### 10.1 Review Linter Rules

```bash
# Check what the linter would report
pnpm biome lint .
```

#### 10.2 Configure Linter Rules

Update `biome.json` to adjust rules as needed:

```json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noForEach": "off"  // If you want to keep forEach
      }
    }
  }
}
```

#### 10.3 Gradually Enable Rules

Start with warnings, then upgrade to errors:

```json
{
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "warn"  // Start as warning
      }
    }
  }
}
```

#### 10.4 Replace ESLint (If Desired)

Once Biome linter is stable, you could remove ESLint entirely:

```bash
pnpm remove eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

**Note**: This is optional and should be done gradually.

## Troubleshooting

### Issue: Formatting Different from Prettier

**Solution**: 
- Check `biome.json` configuration matches `.prettierrc`
- Some edge cases may format differently (acceptable)
- Use `// biome-ignore format:` for specific cases

### Issue: Tests Failing After Format

**Solution**:
- Review git diff for unintended changes
- Check if test fixtures need updating
- Ensure no string literal formatting broke code

### Issue: VS Code Not Using Biome

**Solution**:
- Ensure Biome extension installed
- Check `.vscode/settings.json` has correct formatter
- Reload VS Code window
- Check Biome extension output in VS Code console

### Issue: CI Failing

**Solution**:
- Ensure `biome.json` is committed
- Ensure `@biomejs/biome` is in devDependencies
- Check GitHub Actions has correct commands
- Verify CI runs `pnpm install` before formatting check

## Rollback Plan

If migration causes issues:

### Quick Rollback

```bash
# Reinstall Prettier
pnpm add -D prettier eslint-config-prettier eslint-plugin-prettier

# Restore .prettierrc
git checkout main -- .prettierrc

# Restore package.json scripts
git checkout main -- package.json

# Format with Prettier
pnpm run format

# Remove Biome
pnpm remove @biomejs/biome
rm biome.json
```

## Success Criteria

✅ All tests pass  
✅ TypeScript compiles without errors  
✅ Build completes successfully  
✅ CI/CD pipeline passes  
✅ IDE formatting works correctly  
✅ Code readability maintained or improved  
✅ No runtime errors introduced  

## Next Steps

After successful migration:

1. Monitor for any issues over 1-2 weeks
2. Gather team feedback on Biome experience
3. Consider enabling Biome linter features
4. Update this guide based on lessons learned
5. Consider evaluating dprint if more control needed

## Performance Benefits

Expected improvements:

- **Local Development**: 10-35x faster formatting
- **CI Pipeline**: 2-5 minutes saved per run
- **IDE Performance**: Faster format-on-save
- **Pre-commit Hooks**: Near-instant formatting

## References

- Biome Documentation: https://biomejs.dev/
- Biome Formatter: https://biomejs.dev/formatter/
- Biome vs Prettier: https://biomejs.dev/formatter/#differences-with-prettier
- VS Code Extension: https://marketplace.visualstudio.com/items?itemName=biomejs.biome
- Migration Guide: https://biomejs.dev/guides/migrate-prettier/
