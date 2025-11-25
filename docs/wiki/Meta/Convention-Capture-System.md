# Convention Capture System

## Quick Reference
- **When to use**: Every development session with AI assistants
- **Enforcement**: Required - prevents knowledge loss
- **Impact if violated**: CRITICAL - institutional memory lost

## Overview

The Convention Capture System automatically detects, captures, and preserves development conventions as they emerge during work. This ensures no institutional knowledge is lost to conversation history.

## How It Works

### Detection Signals

Monitor for these signals during development:

| Priority | Signal Words | Action |
|----------|--------------|--------|
| 🚨 **CRITICAL** | NEVER, FORBIDDEN, Zero-tolerance | Immediate capture |
| ⚠️ **HIGH** | MUST, REQUIRED, ALWAYS | Flag for documentation |
| 📋 **MEDIUM** | Prefer, Should, Convention | Track pattern |
| 💡 **LOW** | Consider, Might, Sometimes | Monitor |

### Real-Time Flagging

When a convention is detected:

```
🔔 **CONVENTION DETECTED**

**Name**: AWS SDK Encapsulation
**Type**: Rule
**What**: Never import AWS SDK directly, use vendor wrappers
**Why**: Maintains encapsulation and testability
**Priority**: Critical

Document now? [Y/N]
```

### Convention Tracking

Central registry in `docs/conventions-tracking.md`:

```markdown
## 🟡 Pending Documentation

### Detected: 2025-11-22
1. **Pattern Name** (Type)
   - What: [Description]
   - Why: [Rationale]
   - Target: docs/wiki/[Category]/[Page].md
   - Status: ⏳ Pending

## 🟢 Recently Documented
- [x] **Convention Name** → docs/wiki/[Path]
```

## Implementation Guide

### For AI Assistants

**Session Start**:
1. Read AGENTS.md (contains Convention Capture instructions)
2. Check `docs/conventions-tracking.md` for pending items
3. Activate detection mode

**During Work**:
1. Monitor for detection signals
2. Flag conventions immediately
3. Offer to document or defer
4. Continue with primary task

**Session End**:
1. Generate session summary
2. List detected conventions
3. Update `conventions-tracking.md`
4. List pending documentation tasks

### For Developers

**Setting Up**:
1. Add Convention Capture section to AGENTS.md
2. Create `docs/conventions-tracking.md`
3. Create `docs/templates/` directory
4. Initialize with known conventions

**Contributing**:
1. Work normally with AI assistant
2. Confirm when conventions are flagged
3. Review session summaries
4. Approve wiki documentation

## Detection Patterns

### Explicit Statements
```
"Always use camelCase"
"Never commit secrets"
```
→ Immediate capture as rule

### Corrections
```
"Actually, it's PascalCase not camelCase"
"No, we use OpenTofu not Terraform"
```
→ High priority pattern

### Repeated Decisions
```
First occurrence: "Let's use vendor wrappers"
Second occurrence: "Use vendor wrapper again"
```
→ Pattern detected, suggest documentation

## Documentation Template

```markdown
# [Convention Name]

## Classification
- **Type**: Rule | Pattern | Methodology
- **Priority**: Critical | High | Medium | Low
- **Enforcement**: Zero-tolerance | Required | Recommended

## The Rule
[Clear, concise statement]

## Context
**Problem Solved**: [What issue this addresses]
**Benefits**: [Why it matters]

## Examples
### ✅ Correct
[Code example]

### ❌ Incorrect
[Anti-pattern]

## Enforcement
[How to check/automate]

## Related Patterns
[Links to related conventions]
```

## Benefits

### Immediate
- No repeated explanations - document once, reference forever
- Consistent patterns - same conventions across all work
- Clear communication - shared vocabulary
- Reduced cognitive load

### Long-term
- Institutional memory persists beyond individuals
- Faster onboarding for new team members
- Patterns evolve and improve over time
- Prevents technical debt from bad patterns

## Integration with AGENTS.md

Every project using AGENTS.md automatically gets Convention Capture:

```markdown
# AGENTS.md

## Convention Capture System
[Universal instructions for using system]
[Links to this wiki page]

## Project-Specific Content
[Project details]
```

Each project maintains its own:
- `docs/conventions-tracking.md` - Project conventions
- `docs/sessions/` - Session summaries
- Local overrides and additions

## Related Documentation

- [AGENTS.md Template](AI-Tool-Context-Files.md) - Universal instructions
- [Working with AI Assistants](Working-with-AI-Assistants.md) - Collaboration guide

---

*The Convention Capture System ensures valuable patterns and conventions are never lost. By systematically detecting, tracking, and documenting conventions as they emerge, we build persistent institutional memory that benefits all future work.*
