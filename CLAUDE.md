@AGENTS.md

## Deploy

Always specify `--stage` when deploying. Never run bare `mantle deploy` — it defaults to `dev` which has no tfvars and will prompt interactively.

```bash
npx mantle build                          # build all Lambdas
npx mantle deploy --stage staging         # deploy to staging (staging- prefix)
npx mantle deploy --stage production      # deploy to production (prod- prefix)
```