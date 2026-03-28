@~/.claude/principles/mantle-checks.md
@AGENTS.md

## Mantle Convention Enforcement

This is a Mantle framework instance (the original project Mantle was extracted from). All code must conform to 49 convention checks (C1-C49).

- **Checks**: Imported above from `~/.claude/principles/mantle-checks.md`
- **Full principles**: `~/.claude/principles/mantle.md` — the authoritative source for all conventions
- **Reviewer agent**: `~/.claude/agents/mantle-reviewer.md` — auto-reviews code changes via stop hook
- **Hierarchy**: When this file conflicts with `~/.claude/principles/mantle.md`, mantle.md wins

## Deploy

Always specify `--stage` when deploying. Never run bare `mantle deploy` — it defaults to `dev` which has no tfvars and will prompt interactively.

```bash
npx mantle build                          # build all Lambdas
npx mantle deploy --stage staging         # deploy to staging (staging- prefix)
npx mantle deploy --stage production      # deploy to production (prod- prefix)
```