# Gemini CLI Instructions for Media Downloader

## Context Loading
- **CRITICAL**: At the start of every session, read `repomix-output.xml` if it exists. This contains the full codebase context.
- Read `AGENTS.md` and `docs/wiki/Meta/Conventions-Tracking.md` for project rules and emergent conventions.

## Development Rules
- Adhere to the conventions defined in `docs/wiki/`.
- **Zero Tolerance**: Never import from `@aws-sdk/*` directly. Use wrappers in `#lib/vendor/AWS/`.
- **Testing**: Use `test/helpers/electrodb-mock.ts` for ElectroDB mocking.
- **Commits**: Follow conventional commits. Do NOT include AI attribution in commit messages.
- **Workflow**: Run `pnpm run precheck` before finalizing any changes.

## Useful Commands
- `pnpm run pack:context`: Update the packed context file.
- `pnpm run validate:conventions`: Check code against convention rules.
- `pnpm run precheck`: Run types check and lint.
- `pnpm run test`: Run unit tests.
