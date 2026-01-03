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
| MCP | 6/12 (50%) | Primary enforcement for TypeScript patterns |
| ESLint | 5/12 (42%) | Mirrors MCP for in-editor feedback |
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

1. **Add MCP rule for migrations**
   - Detect schema changes outside `drizzle/migrations/`
   - Enforce CRITICAL "Migrations as Single Source of Truth" convention

2. **Enhance enforcement gap reporting**
   - Add script to compare documented conventions vs implemented enforcement
   - Run in CI to detect drift

3. **Create convention coverage dashboard**
   - Generate markdown report of coverage percentages
   - Track coverage trends over time

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

### Pattern 2: Single-Tool Enforcement (Risky)

Example: **Migrations as Single Source of Truth**
- Only enforced via code review

**Why it's risky**: Easy to bypass during fast iteration. Consider adding automated enforcement.

### Pattern 3: Git Hook Enforcement (Targeted)

Example: **Zero AI References in Commits**
- commit-msg hook with pattern matching

**Why it works**: Enforcement at commit time is unavoidable (without `--no-verify`).

---

## Implementation Priority

| Improvement | Impact | Effort | Priority |
|-------------|--------|--------|----------|
| Add migrations MCP rule | High | Medium | 1 |
| Document Phase 3 activation path | Medium | Low | 2 |
| Create enforcement coverage report | Medium | Medium | 3 |
| Improve LOW severity usage | Low | Low | 4 |
| Session boundary automation | High | High | 5 |

---

## Related Documentation

- [Convention Capture System](Convention-Capture-System.md)
- [Conventions Tracking](Conventions-Tracking.md)
- [MCP Convention Tools](../MCP/Convention-Tools.md)

---

*This document captures the evaluation results from the Convention Capture System effectiveness audit and provides actionable recommendations for improvement.*
