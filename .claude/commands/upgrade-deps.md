# Comprehensive Dependency Upgrade

Perform a full dependency upgrade workflow: update all packages, fix breaking changes, create PR, and clean up dependabot PRs.

## Pre-flight Checks

1. First, list all open dependabot PRs:
```bash
gh pr list --author "app/dependabot" --state open --json number,title,headRefName
```

2. Check outdated packages:
```bash
pnpm outdated
```

## Workflow Steps

### Phase 1: Worktree Setup

Create an isolated worktree for the upgrade work:

```bash
git worktree add -b chore/upgrade-dependencies ../aws-cloudformation-media-downloader-upgrade HEAD
cd ../aws-cloudformation-media-downloader-upgrade
mkdir -p build
pnpm install --frozen-lockfile
```

### Phase 2: Dependency Updates

**Step 2.1: Align AWS SDK packages first (critical)**

All AWS SDK packages must be at the same version. Update them together:

```bash
pnpm update @aws-sdk/client-api-gateway@latest \
            @aws-sdk/client-cloudwatch@latest \
            @aws-sdk/client-dynamodb@latest \
            @aws-sdk/client-lambda@latest \
            @aws-sdk/client-s3@latest \
            @aws-sdk/client-sns@latest \
            @aws-sdk/client-sqs@latest \
            @aws-sdk/lib-dynamodb@latest \
            @aws-sdk/lib-storage@latest \
            @aws-sdk/util-dynamodb@latest
```

**Step 2.2: Update all other dependencies**

```bash
pnpm update --latest
```

### Phase 3: Fix Breaking Changes

Run type checking to identify breaking changes:

```bash
pnpm run check-types
```

**Common breaking change patterns to watch for:**

| Package | Breaking Change | Fix |
|---------|----------------|-----|
| Jest 29→30 | `toThrowError` removed | Use `toThrow` instead |
| Jest 29→30 | Mock type annotations stricter | Add parameter types to `jest.fn<(params) => ReturnType>()` |
| Joi major | Schema API changes | Check changelog, update validation code |
| glob major | Sync API changes | May need async conversion |
| better-auth | New model names in minified output | Add to `excludedSourceVariables` in `infrastructure.environment.test.ts` |

### Phase 4: Verify

Run the full local CI:

```bash
pnpm run ci:local
```

If tests fail, fix the issues and re-run. The pre-push hook will run `ci:local:full` (including integration tests).

### Phase 5: Commit and Push

```bash
git add -A
git commit -m 'chore(deps): upgrade all dependencies to latest versions

- Align AWS SDK packages to X.X.X
- Update [list key packages]
- Fix [any breaking changes]
- Supersedes dependabot PRs #X, #Y, #Z'

git push -u origin chore/upgrade-dependencies
```

**IMPORTANT**: No AI attribution in commits per project conventions.

### Phase 6: Create PR

```bash
gh pr create \
  --title "chore(deps): comprehensive dependency upgrade" \
  --body '## Summary
- Upgrades all outdated dependencies to latest versions
- Aligns AWS SDK packages
- Supersedes dependabot PRs #X, #Y, #Z

## Test Plan
- [x] Local CI passes
- [ ] GitHub CI passes'
```

### Phase 7: Monitor CI and Merge

```bash
# Watch CI status
gh pr checks --watch

# After all checks pass, merge with squash
gh pr merge --squash --delete-branch
```

### Phase 8: Close Dependabot PRs

Close each superseded dependabot PR:

```bash
gh pr close <PR_NUMBER> --comment "Superseded by comprehensive dependency upgrade in #<NEW_PR>"
```

### Phase 9: Cleanup

```bash
# Return to main repo
cd /Users/jlloyd/Repositories/aws-cloudformation-media-downloader

# Pull merged changes
git fetch origin && git pull origin master

# Remove worktree
git worktree remove ../aws-cloudformation-media-downloader-upgrade --force

# Delete local branch if still exists
git branch -D chore/upgrade-dependencies 2>/dev/null || true

# Verify cleanup
git worktree list
```

## Notes

- **AWS SDK alignment**: Per `docs/wiki/Methodologies/Dependabot-Resolution.md`, all AWS SDK packages must be updated together.
- **Major version upgrades**: Check changelogs for Jest, Joi, glob, and other major bumps before proceeding.
- **Pre-push hook**: The project runs `ci:local:full` on push, which includes integration tests with LocalStack.
