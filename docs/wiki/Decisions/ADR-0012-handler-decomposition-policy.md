# ADR 0012: Handler Decomposition Policy

**Date**: 2026-04-22
**Status**: Accepted
**Deciders**: Jonathan Lloyd
**Context**: Convention enforcement expansion (mantle-audit-and-updates-2026-04-21)

## Context

During the convention enforcement expansion, the `handler-size-limit` rule (threshold: 80 lines) flagged all Lambda handlers over 80 lines. An automated extraction pass moved single-consumer helper functions from handlers into `src/services/` files, reducing handler files to under 80 lines.

This raised a fundamental question: **when should a function be extracted from its handler into a separate file?** The 80-line threshold caused extraction of functions that had no other consumer, violating the colocation principle and increasing cognitive load without improving reusability.

## Research Summary

20 web searches via Gemini covering:
- AWS Lambda best practices (AWS docs, Yan Cui, Jeremy Daly)
- Software engineering extraction heuristics (Fowler, Beck, Ousterhout, Sandi Metz)
- Cognitive load research (Minas 2019, Kuang 2024, Wyrich 2023)
- Colocation principles (Kent C. Dodds AHA, Vertical Slice Architecture)
- File size thresholds (ESLint, SonarQube, Clean Code)

### Key Findings

**1. Industry threshold consensus for Lambda handlers:**

| Source | Recommended Threshold |
|--------|----------------------|
| Jeremy Daly (serverless expert) | 200 lines ("Refactor Now" limit) |
| AWS Thin Handler pattern | 20-50 lines for the handler entry point |
| ESLint `max-lines` default | 300-500 lines |
| SonarQube `S104` | 1,000 lines |
| Robert C. Martin (Clean Code) | 50-500 lines (average 100) |

**2. The extraction decision should be driven by consumer count, not line count:**

- **Sandi Metz**: "Duplication is far cheaper than the wrong abstraction." Premature extraction leads to brittle shared code with flags and special cases.
- **Martin Fowler / Don Roberts (Rule of Three)**: Tolerate duplication twice; extract on the third instance. Single-consumer extraction is premature.
- **John Ousterhout (A Philosophy of Software Design)**: "Shallow functions" with complex interfaces (many parameters) add overhead without hiding complexity. Prefers fewer, deeper functions.
- **Kent C. Dodds (AHA Programming)**: "Avoid Hasty Abstractions"—colocate by default, extract only when you feel the pain of duplication.

**3. Cognitive load research supports colocation:**

- Developers spend 30-60% of time on navigation and comprehension (Kuang 2024)
- Centralized classes often demand less cognitive load than highly fragmented designs (Minas 2019)
- 70% of developer activity involves backtracking between files (Wyrich 2023)
- Humans hold 4-7 chunks in working memory; file navigation consumes slots

**4. esbuild bundling eliminates the cold-start argument:**

Since Mantle bundles each Lambda into a single file via esbuild, the number of source files has zero impact on cold start performance. File organization is purely a developer experience concern.

**5. Vertical Slice Architecture supports handler-local helpers:**

Single-consumer logic should live in the handler's own directory (not a generic `src/services/` folder). Extract to shared services only when multiple features need the same logic.

## Decision

### Handler File Size Threshold

**Change the `handler-size-limit` rule threshold from 80 to 150 lines.** This aligns with the lower end of industry consensus (100-200) while still catching genuinely oversized handlers.

### Extraction Policy: The Three-Tier Heuristic

When deciding where a function belongs, apply this decision tree:

#### Tier 1: Keep in Handler File (default)
A function stays in the handler file when:
- It has **exactly one consumer** (the handler)
- It is **< 30 lines** of focused logic
- It does **not** need independent unit testing beyond what handler-level tests provide
- Moving it would require passing **3+ parameters** from the caller (tight coupling signal)

Examples: input parsing, response formatting, simple transforms, error classification.

#### Tier 2: Extract to Handler-Local File
A function moves to a sibling file in the handler's directory when:
- The handler file exceeds 150 lines even with well-organized inline helpers
- The function is **> 30 lines** of complex logic that benefits from isolated testing
- The function is still **single-consumer** but obscures the handler's orchestration flow

**Naming conventions for handler-local files:**
- Use **camelCase** consistent with all other `.ts` files in `src/`: `downloadOrchestrator.ts`, `failureHandler.ts`, `pushHelpers.ts`
- Use descriptive domain-specific names when multiple files are extracted; avoid generic `helpers.ts` in that case
- A single generic `helpers.ts` is acceptable when only one file is extracted
- **Group by cohesion**, not by function count: functions that work on the same concern stay in the same file

**Service graph case (multiple co-located files):**
When a handler needs an internal service graph (for example, an orchestrator that calls a failure handler and recovery module), ALL files in the graph live in the handler's directory. This keeps the entire feature self-contained:

```text
src/lambdas/sqs/StartFileUpload/
  index.ts                    # thin handler (entry point)
  fileHelpers.ts              # simple helpers
  downloadOrchestrator.ts     # main workflow
  failureHandler.ts           # error classification + retry
  s3Recovery.ts               # S3 check + DB recovery
```

The rule is simple: **everything related to a single Lambda lives in that Lambda's directory.** Only code consumed by 2+ Lambdas moves to `src/services/`.

Examples: complex validation, multi-step transformations, traced operations, orchestrators, failure handlers, recovery modules.

#### Tier 3: Extract to Shared Service
A function moves to `src/services/` when:
- It has **2+ consumers** across different Lambda handlers
- It represents a **domain concept** that multiple features need (for example, notification dispatch)
- It wraps an **external integration** that multiple handlers share (for example, YouTube API, APNS)

**`src/services/` is exclusively for multi-consumer code.** If you find a service file with only one Lambda consumer, it belongs in that Lambda's directory (Tier 2).

Examples: notification dispatch (used by StartFileUpload + S3ObjectCreated), notification transformers (used by 4 handlers), device service (used by 4 handlers).

### Current State (after re-inlining)

Single-consumer services have been re-inlined per this ADR. The remaining `src/services/` files are all multi-consumer (2+ Lambda consumers):

**Multi-consumer services (Tier 3, correctly in `src/services/`):**
- `notification/dispatchService.ts` (3 consumers), `notification/transformers.ts` (4 consumers)
- `download/stateManager.ts` (3 consumers), `download/youtubeTracing.ts` (2 consumers)
- `device/deviceService.ts` (4 consumers), `file/fileInitService.ts` (2 consumers)
- `youtube/youtube.ts` (7 consumers)

**Pending: download cluster move to handler directory (Tier 2):**
- `download/downloadOrchestrator.ts` (1 Lambda consumer: StartFileUpload)
- `download/failureHandler.ts` (1 consumer: downloadOrchestrator)
- `download/s3Recovery.ts` (1 consumer: downloadOrchestrator)

These form an internal service graph consumed only by StartFileUpload. Per Option A, they should move to `src/lambdas/sqs/StartFileUpload/` as handler-local files. `stateManager.ts` and `youtubeTracing.ts` stay in `src/services/download/` because they have 2+ consumers.

## Consequences

### Positive
- Handler files are allowed to be self-contained when logic is single-purpose
- Reduces "file sprawl" and navigation tax for single-feature changes
- Aligns with Rule of Three, AHA Programming, and Vertical Slice Architecture
- Reduces risk of "wrong abstraction" from premature generalization

### Negative
- Some handler files will be 100-150 lines (larger than the previous 80-line limit)
- Developers must exercise judgment about the three-tier heuristic rather than following a simple line count

### Neutral
- The `handler-size-limit` rule threshold change from 80 to 150 requires a framework CLI update
- Existing extractions in this PR are functionally correct and do not need immediate reversion

## References

- Sandi Metz, "The Wrong Abstraction" (2016): https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
- John Ousterhout, "A Philosophy of Software Design" (2018): Deep vs. Shallow modules
- Martin Fowler, "Refactoring" (2018): Rule of Three, Inline Method
- Kent C. Dodds, "AHA Programming" (2020): https://kentcdodds.com/blog/aha-programming
- Yan Cui, "Avoid Hasty Abstractions in Serverless" (2023): Distributed monolith risks
- Jeremy Daly, "The 200-Line Heuristic" (2024): Lambda handler threshold
- Kuang et al. (2024): Eye-tracking study on developer navigation (30-60% time on comprehension)
- Minas et al. (2019): Centralized vs. fragmented cognitive load study
