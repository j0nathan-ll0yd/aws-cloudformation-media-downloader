# Convention Capture System

## Quick Reference
- **When to use**: Every development session with AI assistants
- **Enforcement**: Required - prevents knowledge loss
- **Impact if violated**: CRITICAL - institutional memory lost

## Overview

The Convention Capture System is an automated methodology for detecting, capturing, and preserving development conventions as they emerge during work. This ensures no institutional knowledge is lost to conversation history.

## The Problem It Solves

### Without Convention Capture
- Conventions emerge organically but aren't documented
- Repeated explanations of the same patterns
- Inconsistent application across projects
- Knowledge lost between sessions
- Documentation debt that never gets paid
- AI assistants don't know project-specific conventions

### With Convention Capture
- Real-time detection and documentation
- Persistent institutional memory
- Consistent patterns across all work
- Knowledge preserved permanently
- Zero conventions lost to history
- AI assistants automatically aware

## How It Works

### Layer 1: Detection Signals

Monitor for these signals during development:

| Priority | Signal Words | Examples | Action |
|----------|--------------|----------|--------|
| 🚨 **CRITICAL** | NEVER, FORBIDDEN, Zero-tolerance | "NEVER import AWS SDK directly" | Immediate capture |
| ⚠️ **HIGH** | MUST, REQUIRED, ALWAYS | "You MUST use vendor wrappers" | Flag for documentation |
| 📋 **MEDIUM** | Prefer, Should, Convention | "Prefer camelCase for variables" | Track pattern |
| 💡 **LOW** | Consider, Might, Sometimes | "Consider using type imports" | Monitor |

### Layer 2: Real-Time Flagging

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

### Layer 3: Convention Tracking

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

### Layer 4: Session Summary

End of each session:

```markdown
## Session Summary: [Topic]

**Date**: 2025-11-22
**Conventions Detected**: 4
**Conventions Documented**: 2

### New Conventions
1. ✅ Pattern A - Documented
2. ⏳ Pattern B - Pending

### Next Actions
- [ ] Document Pattern B
- [ ] Update wiki page X
```

### Layer 5: Wiki Documentation

Permanent storage in categorized wiki pages following standard template.

## Implementation Guide

### For AI Assistants

#### Session Start
```markdown
1. Read AGENTS.md (contains Convention Capture instructions)
2. Check docs/conventions-tracking.md for pending items
3. Activate detection mode
4. Begin monitoring for signals
```

#### During Work
```markdown
1. Monitor all interactions for detection signals
2. Flag conventions immediately when detected
3. Offer to document or defer
4. Update tracking document
5. Continue with primary task
```

#### Session End
```markdown
1. Generate session summary
2. List all detected conventions
3. Update conventions-tracking.md
4. Create wiki pages for documented conventions
5. List pending documentation tasks
```

### For Developers

#### Setting Up
1. Add Convention Capture section to AGENTS.md
2. Create `docs/conventions-tracking.md`
3. Create `docs/templates/` directory
4. Initialize with known conventions

#### Contributing Conventions
1. Work normally with AI assistant
2. Confirm when conventions are flagged
3. Review session summaries
4. Approve wiki documentation
5. Merge convention updates

## Detection Patterns

### Explicit Statements
```
"Always use camelCase"
"Never commit secrets"
"We require all tests to pass"
```
→ Immediate capture as rule

### Corrections
```
"Actually, it's PascalCase not camelCase for interfaces"
"No, we use OpenTofu not Terraform"
```
→ High priority pattern

### Repeated Decisions
```
First occurrence: "Let's use vendor wrappers"
Second occurrence: "Use vendor wrapper again"
```
→ Pattern detected, suggest documentation

### Strong Language
```
"This is CRITICAL"
"MUST follow this pattern"
"Zero-tolerance for violations"
```
→ Critical priority rule

## Documentation Template

### Standard Convention Format

```markdown
# [Convention Name]

## Classification
- **Type**: Rule | Pattern | Methodology | Philosophy
- **Priority**: Critical | High | Medium | Low
- **Enforcement**: Zero-tolerance | Required | Recommended

## The Rule
[Clear, concise statement]

## Context
**Problem Solved**: [What issue this addresses]
**Origin**: [When/how it emerged]
**Benefits**: [Why it matters]

## Examples
### ✅ Correct
[Code example]

### ❌ Incorrect
[Anti-pattern]

## Enforcement
[How to check/automate]

## Evolution History
- **[Date]**: Initial detection
- **[Date]**: Refinement

## Related Patterns
[Links to related conventions]
```

## Tracking Document Structure

### conventions-tracking.md

```markdown
# Convention Tracking

## 🔴 Critical - Immediate Action

### [Convention Name]
- **Detected**: [Date]
- **Session**: [Topic]
- **Status**: ⏳ Needs documentation
- **Action**: Create wiki page

## 🟡 Pending Documentation

[List of detected but undocumented conventions]

## 🟢 Recently Documented

[List of completed documentation]

## 📊 Statistics
- Total Detected: [N]
- Documented: [N]
- Pending: [N]
- Success Rate: [%]
```

## Success Metrics

### Quantitative
- **Detection Rate**: Conventions detected per session
- **Documentation Rate**: % documented within session
- **Zero Loss Rate**: No conventions lost to history
- **Reuse Count**: Conventions applied across projects

### Qualitative
- **Consistency**: Same patterns everywhere
- **Discoverability**: Easy to find conventions
- **Evolution**: Patterns improve over time
- **Adoption**: Team embraces system

## Benefits

### Immediate
1. **No repeated explanations** - Document once, reference forever
2. **Consistent patterns** - Same conventions across all work
3. **Clear communication** - Shared vocabulary for patterns
4. **Reduced cognitive load** - Don't need to remember everything

### Long-term
1. **Institutional memory** - Knowledge persists beyond individuals
2. **Onboarding speed** - New team members learn faster
3. **Quality improvement** - Patterns evolve and improve
4. **Technical debt reduction** - Conventions prevent bad patterns

## Common Patterns Captured

### Technical Conventions
- Naming standards (camelCase, PascalCase)
- Import organization
- File structure patterns
- Testing strategies
- Error handling approaches

### Process Conventions
- Git workflow rules
- Code review standards
- Documentation requirements
- Deployment procedures
- Security protocols

### Philosophical Conventions
- Convention over configuration
- Git as source of truth
- Test YOUR code principle
- Zero-tolerance policies

## Integration with AGENTS.md

### Universal Application

```markdown
# AGENTS.md

## Convention Capture System

[Instructions for using system]
[Links to this wiki page]
[Detection patterns]

## Project-Specific Content
[Project details]
```

Every project using AGENTS.md automatically gets Convention Capture.

### Project Independence

Each project maintains its own:
- `docs/conventions-tracking.md` - Project conventions
- `docs/sessions/` - Session summaries
- Local overrides and additions

While inheriting universal methodology from AGENTS.md.

## Automation Opportunities

### Detection Scripts
```bash
# Find strong language patterns
grep -r "MUST\|NEVER\|ALWAYS\|REQUIRED" --include="*.md"

# Find correction patterns
grep -r "Actually\|No, it's\|Should be" --include="*.md"
```

### Tracking Automation
- GitHub Actions to check for pending conventions
- Bot to remind about undocumented patterns
- Auto-generation of tracking statistics

### Documentation Automation
- Template expansion for new conventions
- Cross-reference generation
- Consistency checking

## Best Practices

### Do's
✅ Flag immediately when detected
✅ Document within session if possible
✅ Use standard templates
✅ Link between related conventions
✅ Track evolution history

### Don'ts
❌ Let conventions pass unnoticed
❌ Defer documentation indefinitely
❌ Create conflicting conventions
❌ Skip detection monitoring
❌ Lose session summaries

## Troubleshooting

### Convention Not Detected
- Check detection patterns
- Look for subtle signals
- Review session transcript
- Lower detection threshold

### Too Many False Positives
- Refine detection patterns
- Increase signal threshold
- Focus on repeated patterns
- Confirm before documenting

### Documentation Backlog
- Prioritize critical conventions
- Batch similar patterns
- Delegate documentation tasks
- Set documentation sprints

## Evolution

The Convention Capture System itself evolves through:
1. **Usage feedback** - Refine detection patterns
2. **Success metrics** - Measure effectiveness
3. **Team input** - Incorporate suggestions
4. **Tool improvements** - Automate more steps

## Related Documentation

- [AGENTS.md Template](AI-Tool-Context-Files.md) - Universal instructions
- [Documentation Patterns](Documentation-Patterns.md) - How to document
- [Emerging Conventions](Emerging-Conventions.md) - Live convention log
- [Working with AI Assistants](Working-with-AI-Assistants.md) - Collaboration guide

---

*The Convention Capture System ensures that valuable patterns and conventions are never lost. By systematically detecting, tracking, and documenting conventions as they emerge, we build persistent institutional memory that benefits all future work.*