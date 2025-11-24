# Dependabot Resolution

## Quick Reference
- **When to use**: Handling automated dependency update pull requests
- **Enforcement**: Automated via GitHub Actions
- **Impact if violated**: MEDIUM - Security vulnerabilities, outdated dependencies

## Overview

Dependabot creates automated pull requests to update dependencies. This guide defines when to auto-merge, when to review manually, and how to handle different types of updates safely.

## The Rules

### 1. Security Updates: Always Priority

Security updates get expedited review and merge.

### 2. Patch Versions: Auto-Merge

Patch updates (x.x.PATCH) can auto-merge if tests pass.

### 3. Minor Versions: Review Based on Risk

Minor updates need review for critical dependencies.

### 4. Major Versions: Always Manual Review

Breaking changes require thorough testing.

## Auto-Merge Criteria

### ✅ Can Auto-Merge

Dependabot PRs can auto-merge when ALL conditions are met:

```yaml
# .github/dependabot.yml configuration
- type: "patch"           # Only patch versions
- tests: "passing"        # All CI checks green
- package: "devDependency" # Development dependencies
- no-breaking: true       # No breaking changes indicated
```

**Examples that auto-merge**:
- `jest` 29.5.0 → 29.5.1 (patch, dev dependency)
- `eslint` 8.44.0 → 8.44.1 (patch, dev dependency)
- `@types/node` 20.4.1 → 20.4.2 (patch, dev dependency)

### 🔍 Requires Review

These updates need human review:

```yaml
- type: "minor" or "major"  # Version bumps
- tests: "failing"          # Any test failures
- package: "dependency"     # Production dependencies
- security: true            # Security updates (fast review)
```

**Examples needing review**:
- `aws-sdk` 2.x → 3.x (major version, breaking changes)
- `express` 4.18.0 → 4.19.0 (minor version, production)
- Any update that fails tests

## Automated Workflow

### GitHub Actions Configuration

```yaml
# .github/workflows/dependabot-auto-merge.yml
name: Dependabot Auto-Merge

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.event.pull_request.user.login == 'dependabot[bot]'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Check if can auto-merge
        id: check
        run: |
          # Extract version bump type
          if [[ "${{ github.event.pull_request.title }}" =~ patch ]]; then
            echo "can_merge=true" >> $GITHUB_OUTPUT
          else
            echo "can_merge=false" >> $GITHUB_OUTPUT
          fi

      - name: Auto-merge if criteria met
        if: steps.check.outputs.can_merge == 'true'
        run: |
          gh pr merge ${{ github.event.pull_request.number }} \
            --auto --merge \
            --subject "chore: auto-merge dependabot patch update"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Auto-Merge Rules Configuration

```javascript
// .github/auto-merge.js
module.exports = {
  rules: [
    {
      // Auto-merge patch updates for dev dependencies
      match: {
        dependency_type: 'development',
        update_type: 'semver:patch'
      },
      actions: {
        merge: true,
        merge_method: 'squash'
      }
    },
    {
      // Auto-merge @types packages
      match: {
        dependency_name: /^@types\//,
        update_type: ['semver:patch', 'semver:minor']
      },
      actions: {
        merge: true
      }
    },
    {
      // Never auto-merge AWS SDK updates
      match: {
        dependency_name: /^@aws-sdk\//
      },
      actions: {
        merge: false,
        comment: 'AWS SDK updates require manual review'
      }
    }
  ]
}
```

## Manual Review Process

### 1. Check Breaking Changes

```bash
# Review changelog
npm view <package>@<new-version> changelog

# Check release notes
open https://github.com/org/package/releases/tag/v<new-version>

# Review migration guide if major version
open https://github.com/org/package/blob/main/MIGRATION.md
```

### 2. Test Locally

```bash
# Checkout PR
gh pr checkout <pr-number>

# Install dependencies
npm ci

# Run full test suite
npm test

# Run build
npm run build

# Test specific functionality
npm run test:integration
```

### 3. Check for Known Issues

```bash
# Search for issues with the new version
open "https://github.com/org/package/issues?q=is:issue+<version>"

# Check npm for deprecation warnings
npm view <package>@<new-version> deprecated

# Security audit
npm audit
```

### 4. Review Dependency Graph

```bash
# Check what else this updates
npm ls <package>

# Check for duplicate versions
npm ls --depth=0 | grep <package>

# Verify peer dependency compatibility
npm ls --peer
```

## Security Update Handling

### Critical Security Updates

```yaml
# Fast-track process for critical vulnerabilities
priority: CRITICAL
action: merge-immediately-after-tests
notification: alert-team
```

**Process**:
1. Dependabot creates PR with security label
2. CI runs immediately
3. If tests pass → auto-merge
4. If tests fail → alert team for immediate fix
5. Deploy to production ASAP

### Example Security Response

```typescript
// Security update for lodash vulnerability
// CVE-2021-23337: Command Injection

// Before (vulnerable)
"lodash": "4.17.20"

// After (patched)
"lodash": "4.17.21"

// Action: Auto-merge after test pass
// Deploy: Immediate production deployment
```

## Version Update Strategies

### Patch Updates (x.x.PATCH)

```json
{
  "before": "1.2.3",
  "after": "1.2.4",
  "risk": "low",
  "action": "auto-merge if tests pass"
}
```

**What to check**:
- CI status
- No failed tests
- No new warnings

### Minor Updates (x.MINOR.x)

```json
{
  "before": "1.2.3",
  "after": "1.3.0",
  "risk": "medium",
  "action": "review changes, test locally"
}
```

**What to check**:
- New features that might conflict
- Deprecated warnings
- Performance implications
- Bundle size changes

### Major Updates (MAJOR.x.x)

```json
{
  "before": "1.2.3",
  "after": "2.0.0",
  "risk": "high",
  "action": "thorough review and testing"
}
```

**What to check**:
- Breaking changes list
- Migration guide
- API changes
- Required code updates
- Compatibility with other dependencies

## Common Scenarios

### Scenario 1: AWS SDK Update

```yaml
package: "@aws-sdk/client-s3"
update: "3.400.0" → "3.450.0"
type: "minor"
action: "manual review"
```

**Review checklist**:
- [ ] Check AWS SDK changelog
- [ ] Verify no API changes
- [ ] Test all S3 operations
- [ ] Check for deprecations
- [ ] Verify IAM permissions still work

### Scenario 2: Jest Update

```yaml
package: "jest"
update: "29.5.0" → "29.6.0"
type: "minor"
action: "review for test framework"
```

**Review checklist**:
- [ ] Run all tests locally
- [ ] Check for new Jest features
- [ ] Verify test coverage still accurate
- [ ] Update jest.config.js if needed

### Scenario 3: TypeScript Update

```yaml
package: "typescript"
update: "5.0.4" → "5.1.0"
type: "minor"
action: "careful review"
```

**Review checklist**:
- [ ] Build project successfully
- [ ] No new TypeScript errors
- [ ] Check for new strict flags
- [ ] Update tsconfig.json if beneficial

## Grouped Updates

### Handling Multiple Updates

```yaml
# When Dependabot groups updates
PR: "Bump the aws-sdk group with 5 updates"
packages:
  - @aws-sdk/client-s3
  - @aws-sdk/client-dynamodb
  - @aws-sdk/client-lambda
  - @aws-sdk/lib-dynamodb
  - @aws-sdk/smithy-client
```

**Process**:
1. Never auto-merge grouped updates
2. Test each service integration
3. Check for consistent versions
4. Verify no breaking changes across group

## Monitoring and Metrics

### Track Update Health

```typescript
// Track Dependabot metrics
interface DependabotMetrics {
  totalPRs: number
  autoMerged: number
  manuallyMerged: number
  closed: number
  averageTimeToMerge: string
  securityUpdates: number
}

// Weekly report
const report = {
  week: '2024-47',
  metrics: {
    totalPRs: 15,
    autoMerged: 10,
    manuallyMerged: 4,
    closed: 1,
    averageTimeToMerge: '2.5 hours',
    securityUpdates: 2
  }
}
```

### Alert Configuration

```yaml
# Slack notification for security updates
- trigger: security-update
  severity: high
  action: notify-slack-channel
  channel: "#security-alerts"
  message: "Critical security update needs review"

# Email for major version updates
- trigger: major-version
  action: email-team
  subject: "Major dependency update requires review"
```

## Troubleshooting

### Common Issues

#### Tests Fail After Update

```bash
# Revert locally
git checkout package-lock.json
npm ci

# Install specific problematic version
npm install package@problematic-version

# Debug the issue
npm test -- --verbose

# Pin to working version temporarily
npm install package@last-working-version --save-exact
```

#### Merge Conflicts

```bash
# Rebase Dependabot PR
gh pr comment <pr-number> --body "@dependabot rebase"

# Or recreate
gh pr comment <pr-number> --body "@dependabot recreate"
```

#### Auto-Merge Not Working

Check:
1. GitHub Actions enabled
2. Auto-merge workflow permissions
3. Branch protection rules
4. Required status checks

## Best Practices

### Do's

- ✅ Keep dependencies up to date regularly
- ✅ Configure Dependabot for all dependency types
- ✅ Review security updates immediately
- ✅ Test thoroughly before merging
- ✅ Use version ranges appropriately

### Don'ts

- ❌ Ignore Dependabot PRs for weeks
- ❌ Auto-merge without adequate testing
- ❌ Update major versions without review
- ❌ Dismiss security updates
- ❌ Merge failing PRs hoping to fix later

## Configuration Files

### dependabot.yml

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "03:00"
    open-pull-requests-limit: 10
    groups:
      aws-sdk:
        patterns:
          - "@aws-sdk/*"
      dev-dependencies:
        dependency-type: "development"
    labels:
      - "dependencies"
      - "automated"
    reviewers:
      - "team-name"
    commit-message:
      prefix: "chore"
      include: "scope"
```

### Auto-Merge Configuration

```yaml
# .github/auto-merge.yml
enable: true
merge_method: squash_and_merge
delete_branch: true

rules:
  - package_pattern: "^@types/"
    versions: ["patch", "minor"]
    auto_merge: true

  - package_pattern: "^eslint"
    versions: ["patch"]
    auto_merge: true

  - security: true
    auto_merge: true
    priority: high
```

## Related Patterns

- [Library Migration](Library-Migration-Checklist.md) - For major updates
- [Testing Strategy](../Testing/Jest-ESM-Mocking-Strategy.md) - Ensuring updates don't break tests
- [CI/CD Patterns](Convention-Over-Configuration.md) - Automation configuration
- [Security Practices](Production-Debugging.md) - Security update handling

## Enforcement

- **GitHub Settings**: Enable Dependabot
- **Branch Protection**: Require CI to pass
- **Auto-merge Rules**: Configure criteria
- **Monitoring**: Track metrics and alerts

---

*Keep dependencies current, security patches immediate, breaking changes deliberate.*