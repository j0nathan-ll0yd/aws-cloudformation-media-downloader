# Convention Workflow Recommendations

Analysis of the Convention Capture System's effectiveness with recommendations for improvement.

## Workflow Evaluation Summary

### Strengths

| Aspect | Rating | Assessment |
|--------|--------|------------|
| Detection Signals | Good | Clear severity definitions (CRITICAL/HIGH/MEDIUM/LOW) are well-documented |
| Central Registry | Good | Conventions-Tracking.md provides comprehensive enforcement tracking |
| Documentation Flow | Good | Clear path from detection to wiki documentation |
| Multi-Layer Enforcement | Good | MCP, ESLint, Git Hooks, and Dependency Cruiser work together |

### Weaknesses

| Aspect | Rating | Assessment |
|--------|--------|------------|
| Real-time Flagging | Aspirational | No automated system performs this; relies on AI discipline |
| Session Start/End | Manual | Works but depends on AI reading AGENTS.md consistently |
| Enforcement Coverage | Partial | Some CRITICAL conventions lack automated enforcement |
| Tool Consistency | Varies | Coverage varies significantly across tools |

---

## Severity Level Assessment

| Level | Definition | Usage | Appropriate? |
|-------|------------|-------|--------------|
| CRITICAL | Zero-tolerance, blocks commit/build | Security, data integrity, breaking patterns | Yes |
| HIGH | Required, should block CI | Maintainability, consistency | Yes |
| MEDIUM | Preferred patterns | Stylistic, optional improvements | Yes |
| LOW | Consider for new code | Rarely used | Underutilized |

**Recommendation**: Consider using LOW severity more frequently for aspirational conventions that don't warrant warnings but should be tracked.

---

## Enforcement Coverage Matrix

### CRITICAL Conventions

| Tool | Coverage | Notes |
|------|----------|-------|
| MCP | 7/12 (58%) | Primary enforcement for TypeScript patterns |
| ESLint | 6/12 (50%) | Mirrors MCP for in-editor feedback |
| Git Hooks | 2/12 (17%) | Targeted enforcement (AI commits, push protection) |
| Dependency Cruiser | 2/12 (17%) | Architectural boundaries only |
| CI/CD | 1/12 (8%) | Security audit via Dependabot |
| Build-time | 1/12 (8%) | pnpm lifecycle protection |

### HIGH Conventions

| Tool | Coverage | Notes |
|------|----------|-------|
| MCP | 9/18 (50%) | Good coverage of Lambda patterns |
| ESLint | 7/18 (39%) | Missing some Lambda-specific checks |
| Dependency Cruiser | 2/18 (11%) | Domain layer and orphan detection |
| Git Hooks | 1/18 (6%) | Branch-first workflow only |

---

## Improvement Recommendations

### Short-Term (Quick Wins)

1. **Document detection signal usage in commit messages**
   - Add examples to Git-Workflow.md showing how to reference convention severities
   - Helps track which conventions were considered during development

2. **Add ESLint rule for Phase 3 activation checklist**
   - Create tracking issue for each Phase 3 rule
   - Define migration requirements before enabling

3. **Improve LOW severity usage**
   - Move purely aspirational items to LOW severity
   - Add more LOW severity conventions for future improvements

### Medium-Term (Infrastructure)

1. **Add MCP rule for migrations** ✅ *Implemented*
   - `migrations-safety` MCP rule detects schema changes outside schema.ts
   - `migrations-safety` ESLint rule provides multi-layer enforcement
   - Enforces CRITICAL "Migrations as Single Source of Truth" convention

2. **Enhance enforcement gap reporting** ✅ *Implemented*
   - `pnpm run report:gaps` compares documented conventions vs implemented enforcement
   - Scans MCP rules, ESLint rules, Git hooks, and Dependency Cruiser

3. **Create convention coverage dashboard** ✅ *Implemented*
   - `pnpm run dashboard:conventions` generates markdown report
   - Shows coverage by tool and severity
   - Outputs to docs/convention-coverage-dashboard.md

### Long-Term (Automation)

1. **Session boundary automation**
   - Create pre/post hooks for AI sessions
   - Auto-generate session summaries with convention check results

2. **Real-time convention detection**
   - Integrate MCP validation into AI workflow
   - Flag potential conventions during code review

---

## Cross-Tool Enforcement Patterns

### Pattern 1: Multi-Layer Critical Enforcement (Best)

Example: **Vendor Library Encapsulation**
- MCP: `aws-sdk-encapsulation` rule
- ESLint: `local-rules/no-direct-aws-sdk-import`
- Dependency Cruiser: `no-direct-aws-sdk-import`

**Why it works**: Catches issues at development time (ESLint), build time (MCP), and architectural review (Dep Cruiser).

### Pattern 2: Multi-Layer Critical Enforcement (Migrations)

Example: **Migrations as Single Source of Truth** ✅ *Now multi-layer*
- MCP: `migrations-safety` rule
- ESLint: `local-rules/migrations-safety`
- Blocks: schema changes outside schema.ts, DDL in application code

**Why it works**: Catches schema changes at development time (ESLint) and validation time (MCP).

### Pattern 3: Git Hook Enforcement (Targeted)

Example: **Zero AI References in Commits**
- commit-msg hook with pattern matching

**Why it works**: Enforcement at commit time is unavoidable (without `--no-verify`).

---

## Implementation Priority

| Improvement | Impact | Effort | Priority | Status |
|-------------|--------|--------|----------|--------|
| Add migrations MCP rule | High | Medium | 1 | ✅ Done |
| Create enforcement coverage report | Medium | Medium | 2 | ✅ Done |
| Create convention coverage dashboard | Medium | Medium | 3 | ✅ Done |
| Document Phase 3 activation path | Medium | Low | 4 | Pending |
| Improve LOW severity usage | Low | Low | 5 | Pending |
| Session boundary automation | High | High | 6 | Pending |

---

## Related Documentation

- [Convention Capture System](Convention-Capture-System.md)
- [Conventions Tracking](Conventions-Tracking.md)
- [MCP Convention Tools](../MCP/Convention-Tools.md)

---

*This document captures the evaluation results from the Convention Capture System effectiveness audit and provides actionable recommendations for improvement.*
