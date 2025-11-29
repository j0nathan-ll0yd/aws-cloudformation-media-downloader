# Prettier Alternatives Evaluation

**Date**: 2025-11-29  
**Issue**: Explore alternatives to Prettier for more fine-grained formatting control  
**Current Setup**: Prettier with printWidth: 250

## Executive Summary

This document evaluates three alternatives to Prettier for code formatting:
1. **Biome** - Fast, Prettier-compatible formatter with more configurability
2. **dprint** - Plugin-based formatter with extensive configuration options
3. **ESLint + @stylistic** - Maximum control via individual formatting rules

## Current Issues with Prettier

### 1. Inline Object Types
Prettier condenses multi-line object types to single lines when they fit within printWidth (250 chars):

```typescript
// Desired: Multi-line for readability
interface ComplexType {
  field1: string
  field2: number
  field3: boolean
}

// Prettier output: Single line (when under 250 chars)
interface ComplexType {field1: string; field2: number; field3: boolean}
```

### 2. Method Chaining
No control over when method chains break to new lines:

```typescript
// Prettier decides based solely on printWidth
someObject.method1().method2().method3().method4().method5()

// vs desired semantic breaking
someObject
  .method1()
  .method2()
  .method3()
```

### Current Workarounds
1. **Type aliases** - Extract inline types to interface declarations
2. **`// prettier-ignore`** - Per-case exclusion from formatting

## Alternative 1: Biome

**Website**: https://biomejs.dev/

### Overview
- Rust-based formatter and linter (10x faster than Prettier)
- Designed as Prettier replacement with 97% compatibility
- Growing ecosystem support
- Built-in linter replaces ESLint

### Pros
✅ **Performance**: 10-35x faster than Prettier  
✅ **Prettier Migration**: 97% compatible formatter, minimal breaking changes  
✅ **IDE Support**: VS Code, IntelliJ, Neovim, Sublime Text  
✅ **All-in-one**: Replaces both Prettier + ESLint  
✅ **Configuration**: More granular than Prettier (but still opinionated)  
✅ **Growing Momentum**: Rapid development, strong community

### Cons
❌ **Newer Tool**: Less battle-tested than Prettier (released 2023)  
❌ **Limited Fine-Grained Control**: Still opinionated, not as flexible as dprint/ESLint  
❌ **Breaking Changes**: More frequent than Prettier (still maturing)  
❌ **Ecosystem Support**: Some tools may not support it yet

### Evaluation Against Criteria

| Criteria | Score | Notes |
|----------|-------|-------|
| **Prettier Compatibility** | ⭐⭐⭐⭐⭐ 5/5 | 97% compatible, easy migration |
| **Object Type Control** | ⭐⭐⭐ 3/5 | Better than Prettier but still limited |
| **Method Chain Control** | ⭐⭐⭐ 3/5 | Some improvement via `lineWidth` |
| **Editor Integration** | ⭐⭐⭐⭐⭐ 5/5 | VS Code, JetBrains, Neovim, etc. |
| **CI/Pre-commit** | ⭐⭐⭐⭐⭐ 5/5 | Fast, excellent CI performance |
| **Migration Effort** | ⭐⭐⭐⭐⭐ 5/5 | Drop-in replacement, minimal changes |

### Configuration Example

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 250,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "none",
      "bracketSpacing": false
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

### Migration Path
1. Install: `pnpm add -D @biomejs/biome`
2. Init: `pnpm biome init`
3. Configure: Adjust `biome.json` to match Prettier settings
4. Update scripts: Replace `prettier` with `biome format`
5. Update ESLint: Can optionally replace ESLint with Biome linter

### Real-World Adoption
- Used by: Astro, Rome Tools successors, various open-source projects
- GitHub Stars: ~15k (rapidly growing)
- Active development with frequent releases

## Alternative 2: dprint

**Website**: https://dprint.dev/

### Overview
- Rust-based, plugin-driven formatter
- Most configurable option among all alternatives
- Supports TypeScript, JavaScript, JSON, Markdown, TOML, Dockerfile, etc.
- Can integrate with Prettier via plugin

### Pros
✅ **Maximum Configuration**: 30+ TypeScript-specific config options  
✅ **Fine-Grained Control**: Separate settings for object types, method chains, etc.  
✅ **Performance**: 10-30x faster than Prettier  
✅ **Prettier Plugin**: Can fallback to Prettier for unsupported files  
✅ **Multi-Language**: Single tool for many file types  
✅ **Editor Support**: VS Code, Neovim, Sublime Text

### Cons
❌ **Less Mainstream**: Smaller ecosystem than Prettier/Biome  
❌ **Steeper Learning Curve**: Many options to understand  
❌ **Community**: Smaller than Prettier or ESLint  
❌ **IDE Integration**: Not as widespread as Prettier

### Evaluation Against Criteria

| Criteria | Score | Notes |
|----------|-------|-------|
| **Prettier Compatibility** | ⭐⭐⭐⭐ 4/5 | Can use Prettier plugin for compatibility |
| **Object Type Control** | ⭐⭐⭐⭐⭐ 5/5 | `objectExpression.preferSingleLine`, etc. |
| **Method Chain Control** | ⭐⭐⭐⭐⭐ 5/5 | `memberExpression.linePerExpression` |
| **Editor Integration** | ⭐⭐⭐⭐ 4/5 | VS Code, some others (not as universal) |
| **CI/Pre-commit** | ⭐⭐⭐⭐⭐ 5/5 | Excellent performance |
| **Migration Effort** | ⭐⭐⭐ 3/5 | Requires significant config adjustment |

### Configuration Example

```json
{
  "typescript": {
    "lineWidth": 250,
    "indentWidth": 2,
    "useTabs": false,
    "semiColons": "prefer",
    "quoteStyle": "preferSingle",
    "quoteProps": "asNeeded",
    "trailingCommas": "never",
    "bracePosition": "sameLineUnlessHanging",
    "singleBodyPosition": "maintain",
    "operatorPosition": "sameLine",
    "preferHanging": false,
    "preferSingleLine": false,
    "objectExpression.preferSingleLine": false,
    "memberExpression.linePerExpression": true,
    "arrayExpression.preferSingleLine": false,
    "parameters.preferSingleLine": false
  },
  "excludes": [
    "node_modules",
    "dist",
    "build",
    "coverage"
  ],
  "plugins": [
    "https://plugins.dprint.dev/typescript-0.93.0.wasm",
    "https://plugins.dprint.dev/json-0.19.3.wasm",
    "https://plugins.dprint.dev/markdown-0.17.2.wasm"
  ]
}
```

### Key Configuration Options for Our Issues

```json
{
  "typescript": {
    // Object type formatting
    "objectExpression.preferSingleLine": false,
    "typeAnnotation.spaceBeforeColon": false,
    
    // Method chaining
    "memberExpression.linePerExpression": true,
    "callExpression.preferSingleLine": false,
    
    // General
    "preferHanging": false,
    "preferSingleLine": false
  }
}
```

### Migration Path
1. Install: `pnpm add -D dprint`
2. Init: `dprint init`
3. Configure: Extensive `.dprint.json` setup
4. Update scripts: Replace `prettier` with `dprint fmt`
5. Test: Run on entire codebase, adjust config as needed

### Real-World Adoption
- Used by: Deno project, various Rust ecosystem projects
- GitHub Stars: ~3k
- Stable, but smaller community than Prettier

## Alternative 3: ESLint + @stylistic

**Website**: https://eslint.style/

### Overview
- ESLint with stylistic rules from `@stylistic/eslint-plugin`
- Separated from ESLint core in v9.0 (stylistic rules removed)
- Maximum control via individual rules
- Works alongside existing ESLint setup

### Pros
✅ **Maximum Granularity**: Individual rule per formatting concern  
✅ **Ecosystem**: Largest community, best IDE support  
✅ **Gradual Migration**: Can adopt rules incrementally  
✅ **Complete Control**: Every aspect is configurable  
✅ **Existing Setup**: Already using ESLint

### Cons
❌ **Performance**: Slowest option (JavaScript-based)  
❌ **Configuration Overhead**: 100+ rules to configure  
❌ **Maintenance**: More complex setup to maintain  
❌ **Not Opinionated**: Requires decisions on every rule  
❌ **Autofix Conflicts**: Rules can conflict with each other

### Evaluation Against Criteria

| Criteria | Score | Notes |
|----------|-------|-------|
| **Prettier Compatibility** | ⭐⭐⭐ 3/5 | Can approximate but requires extensive config |
| **Object Type Control** | ⭐⭐⭐⭐⭐ 5/5 | `object-curly-newline`, `object-property-newline` |
| **Method Chain Control** | ⭐⭐⭐⭐⭐ 5/5 | `newline-per-chained-call` |
| **Editor Integration** | ⭐⭐⭐⭐⭐ 5/5 | Universal ESLint support |
| **CI/Pre-commit** | ⭐⭐⭐ 3/5 | Slower than alternatives |
| **Migration Effort** | ⭐⭐ 2/5 | Requires extensive rule configuration |

### Configuration Example

```javascript
import stylistic from '@stylistic/eslint-plugin'

export default [
  {
    plugins: {
      '@stylistic': stylistic
    },
    rules: {
      // Object formatting
      '@stylistic/object-curly-newline': ['error', {
        multiline: true,
        minProperties: 3
      }],
      '@stylistic/object-property-newline': ['error', {
        allowAllPropertiesOnSameLine: false
      }],
      
      // Method chaining
      '@stylistic/newline-per-chained-call': ['error', {
        ignoreChainWithDepth: 2
      }],
      
      // Match Prettier settings
      '@stylistic/quotes': ['error', 'single', {avoidEscape: true}],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/max-len': ['error', {code: 250, ignoreUrls: true}],
      '@stylistic/indent': ['error', 2],
      '@stylistic/object-curly-spacing': ['error', 'never']
    }
  }
]
```

### Migration Path
1. Install: `pnpm add -D @stylistic/eslint-plugin`
2. Configure: Add stylistic rules to `eslint.config.mjs`
3. Disable Prettier: Remove from ESLint extends
4. Test: Run `eslint --fix` on codebase
5. Adjust: Tweak rules based on results

### Real-World Adoption
- Used by: Many projects transitioning from ESLint v8 stylistic rules
- Community: Largest ecosystem (ESLint)
- Mature and stable

## Comparison Matrix

| Feature | Prettier | Biome | dprint | ESLint + @stylistic |
|---------|----------|-------|--------|---------------------|
| **Performance** | Baseline | 10-35x faster | 10-30x faster | 2-3x slower |
| **Config Complexity** | Low | Low-Medium | High | Very High |
| **Object Type Control** | None | Limited | Excellent | Excellent |
| **Method Chain Control** | None | Limited | Excellent | Excellent |
| **Migration Effort** | N/A | Easy | Medium | Hard |
| **Ecosystem Maturity** | Mature | Growing | Niche | Mature |
| **Replaces ESLint** | No | Yes | No | N/A (is ESLint) |
| **Opinionated** | Very | Very | Moderate | Not at all |
| **Learning Curve** | Low | Low | Medium | High |

## Recommendations

### Short-Term (Quick Win)
**Recommendation: Biome**

**Rationale**:
- Minimal migration effort (97% Prettier compatible)
- Immediate performance gains (10-35x faster)
- Can replace both Prettier AND ESLint
- Growing ecosystem with strong momentum
- Provides some improvements over Prettier's control

**Trade-offs**:
- Not as fine-grained as dprint or ESLint
- May still need `// biome-ignore` for edge cases
- Less mature (newer tool)

### Medium-Term (More Control)
**Recommendation: dprint**

**Rationale**:
- Maximum configuration without ESLint complexity
- Specific solutions for both stated issues:
  - `objectExpression.preferSingleLine: false`
  - `memberExpression.linePerExpression: true`
- Excellent performance
- Can coexist with Prettier via plugin during migration

**Trade-offs**:
- Requires more extensive configuration
- Less IDE support than Prettier/Biome
- Smaller community for troubleshooting

### Long-Term (Maximum Control)
**Recommendation: ESLint + @stylistic**

**Rationale**:
- Already using ESLint
- Can phase in rules incrementally
- Maximum granular control
- Universal IDE support

**Trade-offs**:
- Significant configuration overhead
- Slower performance
- Complex to maintain
- Many rules to learn and configure

## Migration Considerations

### For This Project Specifically

**Current Setup**:
- Prettier with printWidth: 250
- ESLint with Prettier plugin
- TypeScript codebase (strict)
- Multiple Lambda functions
- Jest tests with ESM modules

**Key Requirements**:
1. Must maintain 250-char line width
2. Must work with TypeScript + Jest
3. Must integrate with CI/CD (GitHub Actions)
4. Must support pre-commit hooks
5. Should improve development speed

### Recommended Approach: Phased Migration to Biome

**Phase 1: Evaluation (1-2 days)**
1. Install Biome in dev dependencies
2. Run Biome on a single Lambda function
3. Compare output with Prettier
4. Test CI integration

**Phase 2: Parallel Operation (1 week)**
1. Configure Biome to match Prettier settings
2. Run both formatters on new code
3. Evaluate differences
4. Update VS Code settings

**Phase 3: Migration (1-2 days)**
1. Remove Prettier dependencies
2. Update package.json scripts
3. Update CI/CD workflows
4. Update .gitignore for Biome cache
5. Format entire codebase with Biome

**Phase 4: Optimization (ongoing)**
1. Gradually adjust Biome rules for better control
2. Consider enabling Biome linter features
3. Monitor for issues in IDE/CI

## Testing Plan

### Before Migration
- [ ] Document current Prettier output for key files
- [ ] Identify files with formatting workarounds (`// prettier-ignore`)
- [ ] Run full test suite to establish baseline

### During Migration
- [ ] Format test directory first (isolated)
- [ ] Run tests after formatting
- [ ] Format source code
- [ ] Run tests again
- [ ] Check Git diff for unexpected changes

### After Migration
- [ ] Update documentation
- [ ] Update contribution guidelines
- [ ] Add formatting check to CI
- [ ] Update VS Code workspace settings
- [ ] Create convention document

## Conclusion

**Immediate Recommendation: Start with Biome**

Biome offers the best balance of:
- Low migration effort
- Performance improvement
- Better (though not perfect) control than Prettier
- Growing ecosystem support
- Path to potentially replacing ESLint

**Future Path: Evaluate dprint if more control needed**

If Biome doesn't provide sufficient control for object types and method chaining, dprint offers significantly more configuration options while maintaining excellent performance.

**Avoid: ESLint + @stylistic**

While offering maximum control, the configuration complexity and performance cost don't justify the benefits for this project's needs.

## References

- Biome Documentation: https://biomejs.dev/
- Biome Formatter: https://biomejs.dev/formatter/
- dprint Documentation: https://dprint.dev/
- dprint TypeScript Plugin: https://dprint.dev/plugins/typescript/
- ESLint Stylistic: https://eslint.style/
- Prettier Documentation: https://prettier.io/
