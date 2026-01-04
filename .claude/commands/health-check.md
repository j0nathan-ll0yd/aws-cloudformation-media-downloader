# AWS CloudFormation Media Downloader - Comprehensive Health Check

You are performing a comprehensive health check of this AWS serverless codebase. This is a
revisit/maintenance pass - many areas are already well-maintained. Your job is to:

1. **Quickly verify** each area is still in good shape
2. **Flag any drift** from documented patterns or new issues
3. **Skip deep analysis** for areas that look healthy
4. **Deep-dive only** into areas showing problems

## Execution Strategy

**USE SUB-AGENTS AGGRESSIVELY.** This codebase is small enough to analyze comprehensively.
Launch multiple sub-agents in parallel to maximize efficiency:

- Use `subagent_type=Explore` for codebase exploration and pattern discovery
- Use `subagent_type=humanlayer:codebase-analyzer` for detailed component analysis
- Use `subagent_type=humanlayer:codebase-pattern-finder` for finding similar implementations
- Use `subagent_type=humanlayer:codebase-locator` to find relevant files quickly

**Parallelization approach:**
- Launch sub-agents for sections 1-5 in parallel
- Launch sub-agents for sections 6-10 in parallel
- Read ALL files in each area, not just samples - the codebase is small

## Output Format

For each section, output one of:
- ✅ **HEALTHY** - Brief confirmation (1-2 sentences) if nothing notable
- ⚠️ **NEEDS ATTENTION** - Specific findings with file:line references and priority
- 🔴 **CRITICAL** - Immediate action required

---

## 1. TESTING INFRASTRUCTURE

**Files to Read (ALL):**
- `vitest.config.mts`, `vitest.integration.config.mts`
- `stryker.config.json`
- ALL files in `test/helpers/`
- ALL Lambda test files: `src/lambdas/*/test/index.test.ts`
- ALL integration tests: `test/integration/`

**Verify:**
- Is vitest.config.mts current with 2025 patterns?
- Do ALL Lambda tests follow factory/fixture patterns consistently?
- Are test helpers (aws-sdk-mock.ts, entity-fixtures.ts) comprehensive for all entities?
- Is Stryker mutation threshold appropriate (currently: high=60, low=40, break=35)?
- Does integration test schema isolation work for parallel execution?
- Are ALL transitive dependencies properly mocked in each test?

**Red Flags:** Unmocked transitive dependencies, tests testing implementation details,
              factory pattern drift, broken integration isolation.

**Sub-agent suggestion:** Launch one agent to analyze unit tests, another for integration tests.

---

## 2. DOCUMENTATION SYSTEM

**Files to Read (ALL):**
- `AGENTS.md`, `CLAUDE.md`
- `.gemini/instructions.md`
- `docs/doc-code-mapping.json`
- `docs/wiki/Meta/Conventions-Tracking.md`
- `docs/wiki/Meta/Convention-Capture-System.md`
- ALL files in `docs/wiki/` (scan for broken links and accuracy)
- `tsp/` directory for TypeSpec definitions
- `docs/api/openapi.yaml`

**Verify:**
- Does AGENTS.md reflect current codebase state?
- Are ALL wiki pages cross-referenced correctly (no broken links)?
- Does docs/doc-code-mapping.json match reality?
- Is the Convention Capture System being used (check recent entries)?
- Is TypeSpec/OpenAPI in sync with ALL actual Lambda handlers?
- Are there orphaned documentation pages?

**Red Flags:** Stale documentation, broken wiki links, conventions not in tracking file,
              TypeSpec ↔ implementation drift.

**Sub-agent suggestion:** Launch one agent for wiki validation, another for TypeSpec alignment check.

---

## 3. INFRASTRUCTURE (OpenTofu)

**Files to Read (ALL):**
- ALL `.tf` files in `terraform/`
- `bin/pre-deploy-check.sh`
- `bin/verify-state.sh`
- `bin/aws-audit.sh`

**Verify:**
- Are ALL Lambda IAM roles following least-privilege?
- Is state management acceptable (local state noted as known issue)?
- Are common_tags applied consistently to ALL resources?
- Do pre-deploy-check.sh and verify-state.sh cover critical validations?
- Are there repeated patterns that should be modularized?
- Is SOPS integration properly configured?

**Red Flags:** Overly permissive IAM policies, missing security groups, resource drift,
              hardcoded values that should be variables.

**Sub-agent suggestion:** Use `humanlayer:codebase-analyzer` focused on terraform/ directory.

---

## 4. SHELL SCRIPTS (bin/)

**Files to Read (ALL):**
- ALL scripts in `bin/`
- `docs/wiki/Bash/Script-Patterns.md`

**Verify:**
- Do ALL scripts use `set -e` or `set -euo pipefail`?
- Are ci-local.sh, ci-local-full.sh, and cleanup.sh aligned in coverage?
- Do deployment scripts have adequate safety checks?
- Are ALL scripts consistent with docs/wiki/Bash/Script-Patterns.md?
- Are there any hardcoded paths or secrets?

**Red Flags:** Missing error handling, shellcheck violations, hardcoded paths/secrets,
              inconsistent patterns between scripts.

**Sub-agent suggestion:** Single agent can handle all 23 scripts comprehensively.

---

## 5. DEPENDENCIES

**Files to Read (ALL):**
- `package.json`
- `.npmrc`
- `pnpm-lock.yaml` (scan for suspicious packages)
- `config/esbuild.config.ts` (for externals)

**Verify:**
- Is .npmrc lifecycle script protection properly configured?
- Are AWS SDK clients pinned consistently (currently 3.958.0)?
- Are there any known vulnerabilities in dependencies?
- Are ALL dev dependencies necessary and current?
- Is minimumReleaseAge configured?
- Is trustPolicy enabled?
- Are there typosquatting-susceptible package names?

**Red Flags:** Missing security settings, unpinned critical dependencies,
              unnecessary dev dependencies, outdated packages with CVEs.

**Sub-agent suggestion:** Single agent with focus on security configuration.

---

## 6. AI AGENT HELPERS (MCP, Commands)

**Files to Read (ALL):**
- `src/mcp/server.ts`
- ALL files in `src/mcp/handlers/`
- ALL files in `src/mcp/validation/`
- ALL files in `.claude/commands/`
- `graphrag/metadata.json`
- `graphrag/extract.ts`

**Verify:**
- Are ALL MCP tools documented and functional?
- Do .claude/commands/ cover common workflows?
- Are ALL 20 validation rules catching violations correctly?
- Is semantic search returning relevant results?
- Is the GraphRAG knowledge graph complete?

**Red Flags:** Broken MCP tools, missing workflow coverage, rules with high false
              positive/negative rates, stale LanceDB index, incomplete GraphRAG.

**Sub-agent suggestion:** Launch one agent for MCP analysis, another for commands/skills review.

---

## 7. SOURCE CODE ARCHITECTURE

**Files to Read (ALL):**
- `docs/wiki/TypeScript/Lambda-Function-Patterns.md`
- `docs/wiki/Conventions/Vendor-Encapsulation-Policy.md`
- `docs/wiki/Conventions/Naming-Conventions.md`
- ALL Lambda handlers: `src/lambdas/*/src/index.ts`
- ALL entity queries: `src/entities/queries/*.ts`
- ALL vendor wrappers: `src/lib/vendor/**/*.ts`
- ALL utilities: `src/util/*.ts`
- ALL type definitions: `src/types/*.ts`
- `build/graph.json` for dependency analysis

**Verify:**
- Do ALL Lambda handlers follow docs/wiki/TypeScript/Lambda-Function-Patterns.md?
- Is vendor encapsulation intact (ZERO direct @aws-sdk imports outside vendor/)?
- Are ALL entity queries using consistent Drizzle patterns?
- Are src/util/ functions well-organized with no duplication?
- Do ALL src/types/ files follow naming conventions?
- Are there any circular dependencies in build/graph.json?

**Red Flags:** Pattern drift in any handler, vendor encapsulation violations,
              entity anti-patterns, duplicated utility code, naming violations.

**Sub-agent suggestion:** Launch parallel agents for: Lambda handlers, entity layer,
                          vendor wrappers, and type definitions.

---

## 8. SECURITY & SUPPLY CHAIN

**Files to Read (ALL):**
- `.npmrc` (security settings)
- `secrets.enc.yaml` existence check (don't read contents)
- ALL Lambda handlers for hardcoded secrets scan
- `src/lambdas/ApiGatewayAuthorizer/src/index.ts`
- `src/lambdas/LoginUser/src/index.ts`
- `src/lib/vendor/BetterAuth/`
- ALL IAM policies in `terraform/*.tf`

**Verify:**
- Is SOPS encryption properly configured?
- Are there ANY hardcoded secrets in code (grep for API keys, tokens, passwords)?
- Is Better Auth + API Gateway authorizer secure?
- Are ALL IAM permissions following least-privilege?
- Is rate limiting configured?
- Are CORS policies appropriate?

**Red Flags:** Exposed secrets, missing encryption, overly permissive policies,
              authentication bypasses, missing rate limiting.

**Sub-agent suggestion:** Launch one agent for secrets scanning, another for IAM review.

---

## 9. BUILD & BUNDLING

**Files to Read (ALL):**
- `config/esbuild.config.ts`
- ALL bundle outputs in `build/lambdas/` (check sizes)
- `package.json` for module type
- `tsconfig.json`

**Verify:**
- Are ALL bundle sizes reasonable (<1MB for most Lambdas)?
- Is tree-shaking effective (no unused code in bundles)?
- Is ESM migration complete (no CommonJS remnants anywhere)?
- Are Lambda layers updated (yt-dlp, ffmpeg)?
- Are source maps configured correctly?
- Are module aliases working?

**Red Flags:** Oversized bundles (>2MB), failed tree-shaking, CommonJS imports,
              outdated binary layers.

**Sub-agent suggestion:** Use MCP tool `analyze_bundle_size` with query="summary".

---

## 10. OBSERVABILITY & MONITORING

**Files to Read (ALL):**
- `src/lib/vendor/AWS/Powertools.ts`
- ALL Lambda handlers for logging/metrics/tracer usage
- `terraform/cloudwatch.tf`
- `src/util/` for error handling utilities

**Verify:**
- Is Powertools (logger, metrics, tracer) used consistently in ALL handlers?
- Are CloudWatch dashboards meaningful and current?
- Is X-Ray tracing propagating across ALL service boundaries?
- Are critical alerts configured (Lambda errors, DLQ, 5xx)?
- Is structured logging consistent across all Lambdas?
- Are correlation IDs propagated?

**Red Flags:** Missing logging in any handler, no custom metrics, broken trace propagation,
              missing critical alarms, inconsistent error handling.

**Sub-agent suggestion:** Single agent can review all observability patterns.

---

## EXECUTION APPROACH

1. **Launch sub-agents in parallel** for independent sections
2. **Read ALL files** in each area - don't sample, be comprehensive
3. **Use MCP tools** for automated checks:
   - `validate_pattern` with query="all" for convention violations
   - `check_coverage` for test dependency analysis
   - `analyze_bundle_size` with query="summary" for build analysis
   - `query_conventions` with query="list" for convention status
4. **Cross-reference findings** between sections (e.g., security issues found in source code)
5. **Aggregate findings** into prioritized action items

## FINAL OUTPUT

Produce a summary table:

| Area | Status | Key Findings | Priority Actions |
|------|--------|--------------|------------------|
| 1. Testing | ✅/⚠️/🔴 | ... | ... |
| 2. Documentation | ✅/⚠️/🔴 | ... | ... |
| 3. Infrastructure | ✅/⚠️/🔴 | ... | ... |
| 4. Shell Scripts | ✅/⚠️/🔴 | ... | ... |
| 5. Dependencies | ✅/⚠️/🔴 | ... | ... |
| 6. AI Agent Helpers | ✅/⚠️/🔴 | ... | ... |
| 7. Source Architecture | ✅/⚠️/🔴 | ... | ... |
| 8. Security | ✅/⚠️/🔴 | ... | ... |
| 9. Build & Bundling | ✅/⚠️/🔴 | ... | ... |
| 10. Observability | ✅/⚠️/🔴 | ... | ... |

Then list ALL specific action items ordered by priority:

### 🔴 CRITICAL (fix immediately)
- ...

### ⚠️ HIGH (fix soon)
- ...

### 📋 MEDIUM (fix when convenient)
- ...

### 💡 LOW (nice to have)
- ...
