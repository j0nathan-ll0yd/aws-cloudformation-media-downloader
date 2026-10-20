# CI Workflow Reference

Every GitHub Actions workflow in `.github/workflows/`: what starts it, where it runs, and what it checks. The workflow files are the source of truth; each section names its file and jobs.

## Runner Lanes

Every job runs on the self-hosted fleet, except one recorded exception.

| Labels                                          | Used by                                     | Notes                                                                   |
| ----------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `[self-hosted, linux, arm64, node]`             | most jobs                                   | Node 24 image with pnpm, gh, jq, OpenTofu, and SOPS                     |
| `[self-hosted, linux, arm64, node-integration]` | `integration-tests.yml`                     | Adds LocalStack and PostgreSQL sidecars                                 |
| `[self-hosted, linux, arm64, base]`             | `pr-ready`, `pr-title.yml`, `sync-wiki.yml` | Ubuntu with git, curl, and jq; no Node                                  |
| `[self-hosted, linux, arm64, image-build]`      | the two `repin-image` jobs                  | Docker-in-Docker lane for the `StartFileUpload` image                   |
| `ubuntu-latest`                                 | `updater-watchdog.yml`                      | Recorded exception (atlas decision 0085): it must report a fleet outage |

## Required Status Checks

Ruleset `main-protection` (id 21322405) requires these contexts on `main`, with the branch up to date before merge:

| Context                 | Workflow and job                            |
| ----------------------- | ------------------------------------------- |
| `Type Check`            | `ci.yml` `typecheck`                        |
| `Lint & Format`         | `ci.yml` `lint`                             |
| `Tests`                 | `ci.yml` `test`                             |
| `Build`                 | `ci.yml` `build`                            |
| `Convention Checks`     | `ci.yml` `conventions`                      |
| `package-version-drift` | `ci.yml` `package-version-drift`            |
| `Validate Dependencies` | `dependency-check.yml` `dependency-check`   |
| `integration-tests`     | `integration-tests.yml` `integration-tests` |
| `pr-ready`              | `pr-checks.yml` `pr-ready`                  |

On 2026-10-20 every other check on this page reported without blocking a merge. Read the live list with `gh api repos/j0nathan-ll0yd/mantle-OfflineMediaDownloader/rulesets/21322405`.

## Workflow Overview

| Workflow                | Trigger                                                               | Lane              | Purpose                                                                                           |
| ----------------------- | --------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `ci.yml`                | push to `main`, pull request                                          | node              | Type check, lint, tests, build and pin gates, conventions, version drift, generated-doc freshness |
| `pr-checks.yml`         | pull request to `main`                                                | node, base        | Quick checks, then `unit-tests.yml` and `integration-tests.yml`; `pr-ready` gates the merge       |
| `unit-tests.yml`        | push to any branch, pull request to `main`, called by `pr-checks.yml` | node              | Validation, build, GraphRAG check, and unit tests                                                 |
| `integration-tests.yml` | push to any branch, pull request to `main`, called by `pr-checks.yml` | node-integration  | Integration tests against LocalStack and PostgreSQL                                               |
| `dependency-check.yml`  | push to `main` or `develop`, pull request                             | node              | Dependency audit and architecture rules                                                           |
| `pr-title.yml`          | pull request opened, edited, or synchronized                          | base              | Conventional Commits pull request title                                                           |
| `docs.yml`              | pull request that changes the wiki or the Vale config                 | node              | Vale lint of `docs/wiki/`                                                                         |
| `api-contract-sync.yml` | spec change on `main` or in a pull request; daily 14:17 UTC; manual   | node              | One tracking issue while the iOS copy of the OpenAPI spec differs                                 |
| `mutation-tests.yml`    | Sunday 06:00 UTC; manual                                              | node              | Stryker mutation testing                                                                          |
| `sync-wiki.yml`         | push to `main` that changes `docs/wiki/**`; manual                    | base              | Publish `docs/wiki/` to the GitHub Wiki                                                           |
| `update-ffmpeg.yml`     | Monday and Thursday 02:17 UTC; manual                                 | node, image-build | ffmpeg pin update and image repin                                                                 |
| `update-yt-dlp.yml`     | Sunday 02:23 UTC; manual                                              | node, image-build | yt-dlp pin update and image repin                                                                 |
| `updater-watchdog.yml`  | daily 03:41 UTC; manual                                               | `ubuntu-latest`   | Issue when an updater has no recent success                                                       |
| `deploy-production.yml` | manual                                                                | node              | Production deploy, behind `vars.ENABLE_PRODUCTION_DEPLOY`                                         |
| `rollback.yml`          | manual                                                                | node              | Redeploy an earlier commit, behind `vars.ENABLE_ROLLBACK`                                         |

## Workflow Details

### ci.yml

**Triggers**: push to `main` or `master`; pull request to `main` or `master` (opened, synchronize, reopened, ready for review).

| Job                        | Check context                     | Timeout (min) | Runs                                                                |
| -------------------------- | --------------------------------- | ------------- | ------------------------------------------------------------------- |
| `typecheck`                | Type Check                        | 25            | `pnpm run typecheck` (source and tests, TypeScript 6)               |
| `typecheck-ts7`            | Type Check (TS7 native, advisory) | 25            | `pnpm run typecheck:ts7`; `continue-on-error`                       |
| `lint`                     | Lint & Format                     | 25            | `pnpm lint`, `pnpm format:check`                                    |
| `test`                     | Tests                             | 25            | `pnpm test`, `pnpm run test:image-drift`                            |
| `build`                    | Build                             | 25            | `pnpm build:ci`, then the `StartFileUpload` pin gates               |
| `conventions`              | Convention Checks                 | 25            | `npx mantle check --severity HIGH`                                  |
| `package-version-drift`    | package-version-drift             | 15            | Self-test, exit-code tests, then the drift check                    |
| `openapi-freshness`        | OpenAPI Freshness                 | 15            | `bin/check-openapi-freshness.sh`                                    |
| `terraform-docs-freshness` | Terraform Docs Freshness          | 15            | `bin/install-terraform-docs.sh`, then `bin/check-terraform-docs.sh` |

The timeouts come from measured job durations; the basis is in comments in `ci.yml`.

**Build pin gates**: gate 2a compares the pinned `bundleHash` in `docker/start-file-upload.pin.json` with the bundle this commit builds. Gate 2b fails a pull request that changes `layers/**` or `docker/Dockerfile.download` without a pin update. Gate 2c checks the digest in ECR and runs only when `vars.CI_ECR_DIGEST_GATE` is `true`. See `docker/start-file-upload.pin.README.md`.

**OpenAPI Freshness**: deletes `docs/api/openapi.yaml`, regenerates it with `pnpm run generate:openapi:spec`, and fails on any difference or on a run that writes no file. The generator exits 0 without writing when it finds no API handlers, so the delete comes first.

**Terraform Docs Freshness**: installs terraform-docs at the version and archive checksum that `bin/install-terraform-docs.sh` pins, deletes `docs/terraform.md`, regenerates it by running the `document:terraform` package script's command, and fails on any difference. It refuses a terraform-docs of another version, which would emit different output. It runs that command with `sh`, not `pnpm run`: pnpm 11 installs every dependency before a run when `node_modules` is missing, and this job installs none.

### pr-checks.yml

**Triggers**: pull request to `main` (opened, synchronize, reopened, ready for review). One run at a time per pull request.

**Flow**:

1. `quick-checks`: format check and lint
2. `full-ci` calls `unit-tests.yml`; `integration` calls `integration-tests.yml`; both wait for `quick-checks`
3. `pr-ready` always runs and fails unless `full-ci` and `integration` succeeded; it is the required context

### unit-tests.yml

**Triggers**: push to any branch; pull request to `main`; `workflow_call` from `pr-checks.yml`.

| Job                  | Runs                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validate`           | Documented scripts exist, doc-code sync, `pnpm audit` (advisory), conventions, OpenSpec drift report (advisory), OpenSpec covers ratchet, environment variables, DSQL migration compatibility |
| `lint-and-types`     | Build, source and test type checks, ESLint, dprint, ShellCheck (`--severity=error`), ESLint local rule tests, `tofu fmt -check`                                                               |
| `build-and-validate` | Dependency graph and build, then `pnpm run validate:graphrag`                                                                                                                                 |
| `test`               | Unit tests with coverage, after `validate`, `lint-and-types`, and `build-and-validate`                                                                                                        |

**GraphRAG**: `pnpm run validate:graphrag` regenerates `graphrag/knowledge-graph.json` and fails on any difference, so a pull request must commit a current graph. No workflow regenerates or commits the graph after merge.

### integration-tests.yml

**Triggers**: push to any branch; pull request to `main`; `workflow_call` from `pr-checks.yml`.

**Behavior**: runs on the `node-integration` lane, whose LocalStack (port 4566) and PostgreSQL sidecars the job reaches through `AWS_ENDPOINT_URL` and `TEST_DATABASE_URL`. It runs `pnpm run test:integration --coverage`, retries once on failure, reports flaky tests from the JUnit report, and uploads the results.

### dependency-check.yml

**Triggers**: push to `main` or `develop`; pull request to `main` or `develop`.

**Validate Dependencies** runs `pnpm audit` (advisory), `.github/scripts/check-upstream-issues.mjs` (stale pnpm overrides) and `pnpm run deps:check` (dependency-cruiser rules). On failure it generates and uploads a dependency report, and on a pull request it also comments.

### pr-title.yml

**Behavior**: the pull request title must follow Conventional Commits with one of these types: `feat`, `fix`, `chore`, `refactor`, `test`, `style`, `ci`, `docs`, `perf`, `revert`.

### docs.yml

**Triggers**: pull request to `main` that changes `docs/wiki/**/*.md`, `.vale.ini` or `.vale/**`.

**Lint Documentation** runs `vale sync` and `vale docs/wiki/` with the styles that `.vale.ini` names.

### api-contract-sync.yml

**Purpose**: compare `docs/api/openapi.yaml` with the copy that `ios-OfflineMediaDownloader` vendors at `APITypes/Sources/APITypes/openapi.yaml`, and keep one tracking issue in this repository in step with the result.

**Triggers**:

- Push to `main` that changes `docs/api/openapi.yaml`, `bin/check-api-contract-sync.sh` or the workflow
- Pull request with the same paths
- Schedule: daily 14:17 UTC
- Manual dispatch (inputs `ios_ref` and `dry_run`)

Only runs on `main` write the issue. A pull request, or a dispatch from another branch, gets a dry run that prints its decisions and writes nothing.

**Behavior** (`bin/check-api-contract-sync.sh`):

1. Files match: closes the tracking issue if it is open
2. Files differ: creates the tracking issue, or replaces its body and reopens it
3. Other open managed issues: closes them as duplicates of the tracking issue
4. Exit 3 means the check could not measure; a red run never means drift

The tracking issue is the lowest-numbered issue that `github-actions[bot]` opened with the `<!-- api-contract-sync:managed -->` marker.

### mutation-tests.yml

**Triggers**: Sunday 06:00 UTC; manual dispatch.

**Behavior**: builds the project, restores the previous Stryker incremental file, runs mutation tests (`pnpm run test:mutation:incremental`), and uploads the report and the new incremental file. Timeout: 60 minutes.

### sync-wiki.yml

**Triggers**: push to `main` that changes `docs/wiki/**`, `.github/scripts/sync-wiki.sh`, `.github/scripts/generate-sidebar.sh` or the workflow; manual dispatch.

**Behavior**: clones the GitHub Wiki repository, copies `docs/wiki/` into it, generates the sidebar and footer, and pushes. A merged change to this page reaches the public wiki this way.

### update-ffmpeg.yml and update-yt-dlp.yml

**Triggers**: `update-ffmpeg.yml` Monday and Thursday 02:17 UTC; `update-yt-dlp.yml` Sunday 02:23 UTC; both by manual dispatch.

| Job              | Lane        | Timeout (min) | Runs                                                                                                            |
| ---------------- | ----------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| `check-update`   | node        | 15            | Finds the upstream release, downloads and verifies it, and opens or updates the pin pull request                |
| `repin-image`    | image-build | 60            | Builds and pushes the `StartFileUpload` image to ECR, then pushes the generated pin commit to that pull request |
| `notify-failure` | node        | 5             | Opens, or comments on, the `<tool> update workflow failed` issue when `check-update` or `repin-image` failed    |

Merging a pin pull request does not deploy it; `pnpm run check:image-drift` reports a committed pin that staging is not running yet.

### updater-watchdog.yml

**Triggers**: daily 03:41 UTC; manual dispatch.

**Behavior**: runs on `ubuntu-latest`, so that it still reports when the fleet is down. When `update-ffmpeg.yml` has no success in 120 hours or `update-yt-dlp.yml` has none in 216 hours, it fails and opens or edits the issue `Dependency updater schedule watchdog alert`. It closes that issue once both recover.

### deploy-production.yml and rollback.yml

Both are manual only; CI never deploys (`mantle.config.ts` `ci.deploy: false`). `deploy-production.yml` requires the input `confirm` to be `deploy`, and its deploy job runs only when `vars.ENABLE_PRODUCTION_DEPLOY` is `true`. `rollback.yml` takes an `environment` and an optional `commit_sha`, and runs only when `vars.ENABLE_ROLLBACK` is `true`. Both call `npx mantle deploy`, and `mantle.config.ts` `allowedStages` refuses every stage except staging until stage-scoped state lands.

## Manual Workflow Triggers

```bash
gh workflow run api-contract-sync.yml -f dry_run=true
gh workflow run mutation-tests.yml
gh workflow run sync-wiki.yml
gh workflow run update-ffmpeg.yml
gh workflow run update-yt-dlp.yml
gh workflow run updater-watchdog.yml
```

Deploys and rollbacks are owner actions; see the Deployment Commands section of `AGENTS.md`.

## Troubleshooting

### Type Check, Lint & Format or Tests failing

1. Run `pnpm run typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test`
2. `pnpm run precheck` runs the same gates as the pre-push hook

### Build failing at a pin gate

1. Gate 2a or 2b: run `bin/refresh-download-image.sh` on an authorized Docker host to rebuild, push, and repin
2. See `docker/start-file-upload.pin.README.md`

### integration-tests failing

1. Start the services: `pnpm run localstack:start`
2. Check them: `pnpm run localstack:health`
3. Run the tests: `pnpm run test:integration`

### Validate Dependencies failing

1. Run `pnpm run deps:check`
2. Generate the report: `pnpm run deps:report`
3. Check for circular dependencies and direct vendor imports

### OpenAPI Freshness or api-contract-sync failing

1. `OpenAPI Freshness` red: run `pnpm run generate:openapi` and commit `docs/api/`
2. `api-contract-sync` red: read the `UNMEASURED:` line; it names the input or GitHub call that failed
3. An open `API contract drift` issue is not a failure: sync the iOS copy with `bash Scripts/sync-openapi.sh` in `ios-OfflineMediaDownloader`

### Terraform Docs Freshness failing

1. Install the pinned terraform-docs: `bin/install-terraform-docs.sh` takes a target directory; put that directory first on `PATH`
2. Run `pnpm run document:terraform` and commit `docs/terraform.md`
3. Run `bin/check-terraform-docs.sh` to confirm

### GraphRAG validation failing

1. Run `npx mantle generate graph && pnpm run validate:graphrag` locally. CI regenerates `build/graph.json` first; a stale local copy gives a wrong graph
2. If metadata validation fails, make `graphrag/metadata.json` list exactly the Lambdas in `src/lambdas/`, each with a complete entry
3. Commit the regenerated `graphrag/knowledge-graph.json`

### An updater failure issue is open

1. Open the run that the issue links
2. `check-update` failures are upstream or network problems; `repin-image` failures are image build or ECR problems
3. The issue stays open for the next failure to comment on; close it after a successful run
