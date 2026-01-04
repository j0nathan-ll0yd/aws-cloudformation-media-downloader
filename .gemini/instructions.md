# Gemini CLI Instructions for Media Downloader

## Quick Start

- **CRITICAL**: Read `AGENTS.md` at session start (comprehensive project context)
- If available, load `repomix-output.xml` for full codebase context
- Check `docs/wiki/Meta/Conventions-Tracking.md` for all active conventions

## CRITICAL Rules (Zero Tolerance)

1. **Vendor Encapsulation**: NEVER import `@aws-sdk/*` directly. Use `#lib/vendor/AWS/`
2. **Entity Mocking**: Mock `#entities/queries` with vi.fn(), NOT legacy entity modules
3. **No AI in Commits**: NO emojis, "Claude", "AI", "Generated with" in commit messages
4. **Cascade Deletions**: Use `Promise.allSettled`, delete children before parents
5. **Environment Variables**: Use `getRequiredEnv()` inside functions, not at module level

## Testing Patterns

- Use `test/helpers/entity-fixtures.ts` for mock entity data
- Use `test/helpers/aws-sdk-mock.ts` for AWS SDK v3 mocking (aws-sdk-client-mock)
- Mock ALL transitive dependencies (check `build/graph.json`)
- See: `docs/wiki/Testing/Vitest-Mocking-Strategy.md`

### Mock Example

```typescript
vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  getUserFiles: vi.fn(),
}))
```

## Development Workflow

```bash
pnpm run precheck           # TypeScript + ESLint (run before commits)
pnpm run validate:conventions  # AST-based convention checks
pnpm run test               # Run unit tests
pnpm run format             # Auto-format with dprint
pnpm run ci:local           # Fast local CI (~2-3 min)
```

## Architecture

- **Database**: Aurora DSQL with Drizzle ORM
- **Entities**: `src/entities/queries/` for all database operations
- **Vendor wrappers**: `src/lib/vendor/AWS/`, `src/lib/vendor/Drizzle/`
- **Testing**: Vitest (NOT Jest)

## Key Files

- **Project Rules**: `AGENTS.md`
- **Conventions**: `docs/wiki/Meta/Conventions-Tracking.md`
- **Dependencies**: `build/graph.json` (use for test mocking)
- **Testing Helpers**: `test/helpers/entity-fixtures.ts`, `test/helpers/aws-sdk-mock.ts`

## Reference

- Full context: `AGENTS.md`
- Architecture diagrams: `docs/wiki/Architecture/System-Diagrams.md`
- Testing patterns: `docs/wiki/Testing/Vitest-Mocking-Strategy.md`
- Lambda patterns: `docs/wiki/TypeScript/Lambda-Function-Patterns.md`
