# See AGENTS.md

This project uses AGENTS.md as the single source of truth for AI coding assistant context.

Please see AGENTS.md in the repository root for comprehensive project documentation and guidelines.

## Quick Reference

- **Conventions**: `docs/wiki/` (Source of Truth) & `docs/conventions-tracking.md` (Recent)
- **Pack Context**: `pnpm run pack:context` (Updates `repomix-output.xml`)
- **Validate**: `pnpm run validate:conventions` (Checks against rules)
- **Test**: `pnpm run test` (Unit)
- **Check**: `pnpm run precheck` (Lint + Type Check)
