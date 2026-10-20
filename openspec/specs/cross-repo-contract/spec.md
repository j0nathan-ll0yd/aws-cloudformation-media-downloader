# Cross-Repo Contract (OMD-iOS API)

## Purpose

Establish the OMD backend as the single canonical producer of the iOS API contract — the OpenAPI
document at `docs/api/openapi.yaml` — and ensure the iOS companion (`ios-OfflineMediaDownloader`)
never silently drifts from that contract. The document is generated credential-free from the
committed Zod schemas and handler definitions (`package.json` `generate:openapi:spec` script). A CI
gate keeps the committed document equal to the generator output, and a sync check keeps one
tracking issue open while the iOS vendored copy differs from it. Schema evolution is additive-only
so iOS clients built against an older spec continue to parse current payloads.

Source of truth for behavior: `package.json` (`generate:openapi:spec` and `generate:openapi`
scripts), `bin/check-openapi-freshness.sh` (freshness gate, run by `.github/workflows/ci.yml` job
`openapi-freshness`) and `bin/check-api-contract-sync.sh` (sync check, run by
`.github/workflows/api-contract-sync.yml`). The structural contract itself is owned by
`docs/api/openapi.yaml` — this spec describes behavioral invariants only and does NOT restate its
field-level shapes.

## Requirements

### Requirement: backend-is-sole-producer-of-openapi

The OMD backend SHALL be the only source that generates `docs/api/openapi.yaml`. No consumer
(iOS app or other service) SHALL independently derive or hardcode API contract definitions.
The iOS companion SHALL obtain the canonical contract by syncing the committed `docs/api/openapi.yaml`
via `bash Scripts/sync-openapi.sh` in `ios-OfflineMediaDownloader`.

#### Scenario: iOS companion needs updated API types

- **GIVEN** the iOS companion needs to regenerate its Swift APITypes from a changed backend schema
- **WHEN** the iOS repository regenerates its API types
- **THEN** it SHALL run `bash Scripts/sync-openapi.sh` against the OMD backend's committed
  `docs/api/openapi.yaml`
- **AND** it SHALL NOT independently regenerate endpoint definitions or hardcode API addresses

### Requirement: credential-free-openapi-generation

`mantle generate openapi` SHALL regenerate `docs/api/openapi.yaml` from the committed Zod schemas
and handler definitions without requiring any AWS credentials. This allows the freshness gate
(`bin/check-openapi-freshness.sh`, run by the `.github/workflows/ci.yml` job `openapi-freshness`)
and local workflows to regenerate and diff the spec without cloud access.

#### Scenario: Regeneration in a credential-free environment

- **GIVEN** an environment with no AWS credentials (CI runner or local pre-commit)
- **WHEN** `npx mantle generate openapi` runs
- **THEN** it SHALL emit a valid OpenAPI document without querying live AWS infrastructure
- **AND** the emitted document SHALL be diffable against the committed `docs/api/openapi.yaml`

### Requirement: contract-drift-is-gated-and-tracked

The freshness gate SHALL fail when the committed `docs/api/openapi.yaml` differs from the output of
`pnpm run generate:openapi:spec`, and SHALL fail when the generator writes no document. The sync
check SHALL compare the committed `docs/api/openapi.yaml` with the iOS vendored copy
(`APITypes/Sources/APITypes/openapi.yaml` in `ios-OfflineMediaDownloader`). While the two differ,
exactly one open tracking issue in this repository SHALL cite `bash Scripts/sync-openapi.sh` as the
resolution step. The sync check SHALL edit that issue rather than open another, SHALL close it when
the files match, and SHALL treat only an issue that the workflow token opened as the tracking issue.
A check that cannot read either file or the issue list SHALL fail rather than pass.

`ci.yml` runs the freshness gate on every pull request and every push to `main`, with no path
filter, because a toolchain bump changes the output without touching a schema file.
`api-contract-sync.yml` runs the sync check on every push to `main` that changes the committed spec,
daily, and on demand. A pull request that changes the spec gets a dry run that writes nothing.

Verified by `test/ci/check-openapi-freshness.test.ts:1` (the freshness gate passes on an equal
document, fails and prints the difference on a changed one, and fails when the generator exits 0
without writing) and `test/ci/check-api-contract-sync.test.ts:1` (the sync check opens one issue
that cites the sync script, edits it on the next run, closes it on a match, reopens it on renewed
drift, ignores a marker in an issue another account opened, and exits 3 on unreadable input).

#### Scenario: Schema change without a regenerated openapi.yaml

- **GIVEN** a pull request that changes a Zod API schema, a handler or the Mantle toolchain without
  regenerating `docs/api/openapi.yaml`
- **WHEN** the `openapi-freshness` job runs
- **THEN** the job SHALL fail and print the difference

#### Scenario: Generator writes no document

- **GIVEN** a generator run that exits 0 without writing `docs/api/openapi.yaml`, for example
  because it discovers no API handlers
- **WHEN** the `openapi-freshness` job runs
- **THEN** the job SHALL fail

#### Scenario: Backend spec changed and the iOS copy is not yet synced

- **GIVEN** the committed `docs/api/openapi.yaml` differs from the iOS vendored copy
- **WHEN** the sync check runs twice
- **THEN** exactly one open tracking issue SHALL exist and cite `bash Scripts/sync-openapi.sh`
- **AND** the second run SHALL edit that issue rather than open another

#### Scenario: iOS copy synced

- **GIVEN** an open tracking issue
- **WHEN** the sync check finds the committed spec and the iOS vendored copy identical
- **THEN** it SHALL close the tracking issue

### Requirement: additive-only-schema-evolution

The OpenAPI schema SHALL evolve additively. A field present in a committed version of
`docs/api/openapi.yaml` SHALL NOT be removed in a subsequent version. A field that is no longer
populated SHALL be deprecated to `null` rather than deleted, so iOS clients built against an older
spec continue to parse current payloads without breaking.

#### Scenario: A response field is retired

- **GIVEN** a field in `docs/api/openapi.yaml` that the backend no longer populates
- **WHEN** the schema is updated
- **THEN** the field SHALL remain in the schema and be emitted as `null` rather than removed
