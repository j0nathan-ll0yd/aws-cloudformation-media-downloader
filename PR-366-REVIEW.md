# PR #366 Review: docs: implement wiki framework benchmarking recommendations

**Reviewer:** jeremy (mantle/crew)
**Date:** 2026-01-24
**Branch:** `docs/wiki-evaluation-2026-01`
**Status:** ⚠️ REQUIRES REBASE BEFORE MERGE

---

## Executive Summary

The documentation changes in this PR are **high quality and valuable**. However, the branch is significantly out of date with master, having diverged at commit `bc2170b`. Merging as-is would inadvertently revert recent infrastructure changes (PR #367, #368) including:

- Terraform S3 remote state backend
- EventBridge permission extraction refactor
- Rich metadata fields for video files

**Recommendation:** Rebase onto current master, resolve any conflicts in documentation files, then approve.

---

## Documentation Quality Assessment

### Strengths

#### 1. Architecture-Overview.md (Excellent)
- Well-structured C4 diagrams (Context and Container levels)
- Clear rationale for each architectural decision
- Documents trade-offs honestly (e.g., "Higher per-query cost than DynamoDB")
- Links to related documentation appropriately
- Fills a critical gap - previously no 10,000ft view existed

#### 2. Tutorial-First-Lambda.md (Excellent)
- Follows Good Docs Quickstart template pattern
- Step-by-step with verification checkpoints
- Includes anti-patterns section ("WRONG: Module-level getRequiredEnv")
- Practical troubleshooting guide
- Links to deeper documentation for each concept

#### 3. Vale Linter Integration (Good)
- Sensible rule customization for technical docs
- Disables false-positive-prone rules (Spelling, Acronyms, WordList)
- Keeps valuable style rules active (Latin, Quotes, Units)
- CI workflow triggers only on docs changes (efficient)

#### 4. Home.md Navigation Expansion (Good)
- Links increased from ~37 to 122 (+230%)
- New sections: Architecture, Security, Observability, MCP Tools
- Logical grouping of related content

#### 5. Freshness Metadata Convention (Good)
- Clear YAML frontmatter format
- Documented review schedules by document type
- Status values (current/stale/archived) are practical
- 15 assessment documents now have metadata

### Areas for Improvement

#### 1. File Moves Need Link Updates
Three files were moved:
- `Authentication/Better-Auth-Architecture.md` → `Security/`
- `Integration/LocalStack-Testing.md` → `Testing/`
- `API/Documentation-Audit-2026-01-02.md` → `Meta/`

PR description claims "10 wiki files: Updated broken links after file moves" - this should be verified after rebase.

#### 2. Tutorial Uses Outdated Patterns
The tutorial references patterns that may have changed:
- `#util/response` - verify this path still exists
- `#util/env` - now `#lib/system/env`?
- Generic handler pattern vs new base class pattern

Recommend verifying tutorial code compiles after rebase.

#### 3. Google Style Rules Vendored
The PR vendors Google Vale styles in `.vale/styles/Google/` (36 files). Consider using Vale's package management (`Packages = Google` in .vale.ini) to avoid maintaining vendored copies.

---

## Merge Blocker Analysis

### Current Branch State
```
Merge base: bc2170b (LocalStack testing coverage PR)
Current master: 7bf26f2 (includes PRs #367, #368)
Commits behind: ~8 commits
```

### Files That Would Be Incorrectly Changed

| File | Effect of Merge | Correct State |
|------|-----------------|---------------|
| `src/lib/lambda/handlers/RequiresEventBridge.ts` | RE-ADDED (deleted on master) | Should stay deleted |
| `terraform/backend.tf` | DELETED (added on master) | Should exist |
| `terraform/bootstrap/` | DELETED (added on master) | Should exist |
| `src/types/eventBridgePermissions.ts` | RE-ADDED | Should stay deleted |
| `scripts/extractEventPermissions.ts` | DELETED | Should stay deleted |

### Resolution Steps
1. `git fetch origin master`
2. `git rebase origin/master`
3. Resolve conflicts (likely in docs/wiki files only)
4. Re-run Vale linter: `vale docs/wiki/`
5. Verify tutorial code paths still valid
6. Force push: `git push --force-with-lease`

---

## Detailed File Review

### New Files (7)

| File | Lines | Quality | Notes |
|------|-------|---------|-------|
| `Architecture-Overview.md` | 254 | ⭐⭐⭐⭐⭐ | Best new addition |
| `Tutorial-First-Lambda.md` | 383 | ⭐⭐⭐⭐ | Verify code paths |
| `Documentation-Style-Guide.md` | 213 | ⭐⭐⭐⭐ | Clear conventions |
| `Documentation-Freshness.md` | 137 | ⭐⭐⭐⭐ | Practical system |
| `Wiki-Framework-Evaluation-Final-2026-01.md` | 234 | ⭐⭐⭐ | Meta-evaluation |
| `.vale.ini` | 24 | ⭐⭐⭐⭐ | Well-configured |
| `.github/workflows/docs.yml` | 26 | ⭐⭐⭐⭐ | Minimal, focused |

### CI Workflow Assessment

```yaml
on:
  pull_request:
    paths:
      - 'docs/wiki/**/*.md'
      - '.vale.ini'
      - '.vale/**'
```

Good: Only triggers on documentation changes, won't add CI time to code PRs.

---

## Recommendation

**DO NOT MERGE** until rebased onto current master.

After rebase:
- Documentation changes: **APPROVE**
- Framework score improvement claim (7.3 → 8.7): Reasonable given additions
- Vale integration: **APPROVE** (consider switching to package management later)
- Freshness tracking: **APPROVE**

The documentation work is solid and fills real gaps. The tutorial and architecture overview alone justify the PR. Just needs the mechanical rebase work.

---

## Checklist for PR Author

- [ ] Rebase onto current master (7bf26f2 or later)
- [ ] Resolve any conflicts in docs/ files
- [ ] Verify Mermaid diagrams render in GitHub preview
- [ ] Verify tutorial code paths match current codebase
- [ ] Run `vale docs/wiki/` locally to confirm no regressions
- [ ] Update PR description if file counts change after rebase

---

*Review by mantle/crew/jeremy*
