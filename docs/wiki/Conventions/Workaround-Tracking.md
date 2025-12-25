# Workaround Tracking

When implementing workarounds for upstream dependency issues, follow this process to ensure they don't become permanent technical debt.

## The Problem

Workarounds for upstream bugs or limitations can persist indefinitely if not tracked. When the upstream issue is fixed, we may continue using unnecessary workaround code.

## The Solution

Every workaround requires two things:

1. **Tracking GitHub Issue** - Documents the workaround in our repository
2. **Automated Monitoring Workflow** - Checks upstream issue status weekly

## Process

### 1. Implement the Workaround

Add the workaround code with a comment linking to both issues:

```typescript
// WORKAROUND: OTEL collector deprecation warnings
// Upstream: https://github.com/open-telemetry/opentelemetry-js/issues/4173
// Tracking: #216
// Remove when upstream issue is closed
process.env.NODE_OPTIONS = '--no-deprecation'
```

### 2. Create a Tracking Issue

Create a GitHub issue in our repository that:
- Describes the problem
- Links to the upstream issue
- Documents the workaround impact
- Labels with `workaround` and `upstream`

Example title: `Track: OTEL deprecation warning workaround`

### 3. Add to Monitoring Workflow

Update `.github/workflows/check-upstream-issues.yml`:

```yaml
trackedIssues:
  - owner: "open-telemetry"
    repo: "opentelemetry-js"
    issue_number: 4173
    our_issue: 216
    description: "OTEL collector deprecation warnings"
```

### 4. Automated Monitoring

The workflow runs weekly and:
- Checks if each tracked upstream issue is closed
- Posts a comment to our tracking issue when upstream is fixed
- Allows us to remove the workaround

## Workflow Configuration

`.github/workflows/check-upstream-issues.yml`:

```yaml
name: Check Upstream Issues
on:
  schedule:
    - cron: '0 9 * * 1'  # Weekly on Monday at 9am UTC
  workflow_dispatch:      # Manual trigger

jobs:
  check-issues:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check upstream issues
        uses: actions/github-script@v7
        with:
          script: |
            const trackedIssues = [
              {
                owner: "open-telemetry",
                repo: "opentelemetry-js",
                issue_number: 4173,
                our_issue: 216,
                description: "OTEL collector deprecation warnings"
              }
            ]

            for (const issue of trackedIssues) {
              const {data} = await github.rest.issues.get({
                owner: issue.owner,
                repo: issue.repo,
                issue_number: issue.issue_number
              })

              if (data.state === 'closed') {
                await github.rest.issues.createComment({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  issue_number: issue.our_issue,
                  body: `Upstream issue has been closed. The workaround for "${issue.description}" can now be removed.\n\nUpstream: ${data.html_url}`
                })
              }
            }
```

## Enforcement

| Aspect | Method |
|--------|--------|
| Workaround creation | Code review |
| Tracking issue | Required for PR approval |
| Workflow update | Required for PR approval |
| Removal | Automated notification |

## Example Workarounds

| Workaround | Upstream Issue | Our Tracking | Status |
|------------|---------------|--------------|--------|
| OTEL deprecation suppression | opentelemetry-js#4173 | #216 | Active |
| ElectroDB CJS shim | electrodb#xxx | #xxx | Active |

## Benefits

1. **No forgotten workarounds**: Automated monitoring ensures cleanup
2. **Clear documentation**: Comments link to tracking issues
3. **Proactive notification**: We know when to act
4. **Reduced tech debt**: Workarounds are temporary by design
