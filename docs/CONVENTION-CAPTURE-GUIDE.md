# Convention Capture System Guide

## Overview

The Convention Capture System is a systematic approach to capturing emergent conventions, patterns, rules, and methodologies as they arise during development work. It ensures no institutional knowledge is lost to conversation history and builds a persistent knowledge base.

## Problem Statement

**Before Convention Capture:**
- ❌ Valuable conventions emerge during work but aren't documented
- ❌ Same patterns explained repeatedly across sessions
- ❌ Inconsistent application of standards
- ❌ Knowledge loss when team members change
- ❌ Documentation debt that never gets paid

**With Convention Capture:**
- ✅ Conventions automatically detected in real-time
- ✅ Persistent knowledge across sessions
- ✅ Consistent pattern application
- ✅ Zero knowledge loss
- ✅ Documentation happens during work, not after

## System Architecture

The system consists of 5 integrated layers:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Real-Time Detection (During Conversation)         │
│  └─ AI assistant flags conventions as they emerge          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Conventions Tracking (docs/conventions-tracking.md)│
│  └─ Central registry of all detected conventions           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Session Summaries (End of Session)                │
│  └─ Comprehensive recap of conventions discovered          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Structured Documentation (Wiki Pages)             │
│  └─ Formal convention pages using templates                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Emerging Conventions Log (Live Wiki Page)         │
│  └─ Real-time append-only log of all detections            │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### For AI Assistants

#### Start of Session
1. Read `docs/conventions-tracking.md`
2. Review detection patterns in `docs/convention-detection-patterns.md`
3. Activate detection mode

#### During Session
1. Monitor for [detection signals](#detection-signals)
2. Flag conventions when detected:
   ```
   🔔 **CONVENTION DETECTED**

   **Name**: [Convention Name]
   **Type**: [Rule/Pattern/Methodology/Convention]
   **What**: [One-sentence description]
   **Why**: [Brief rationale]
   **Priority**: [Critical/High/Medium/Low]

   Document now? [Y/N]
   ```
3. Add to `docs/conventions-tracking.md` if confirmed

#### End of Session
1. Use `docs/templates/session-summary-template.md`
2. Generate session summary
3. Update `docs/conventions-tracking.md`
4. List pending documentation tasks

### For Developers

#### Contributing
1. Review `docs/conventions-tracking.md` before starting work
2. Follow documented conventions
3. Suggest updates when conventions need refinement
4. Help document pending conventions

#### When Convention Detected
1. AI will flag with 🔔 **CONVENTION DETECTED**
2. Confirm whether to document: Y/N
3. Convention added to tracking document
4. Documentation task created

## Detection Signals

### 🚨 CRITICAL Priority (Zero-Tolerance Rules)

| Signal | Example | Action |
|--------|---------|--------|
| Explicit Prohibition | "NEVER do X" | Document immediately |
| Zero-Tolerance Language | "No exceptions" | Critical rule |
| Security/Safety | "Security vulnerability" | High priority |
| Correction with Emphasis | "Actually, it's X not Y" | Important distinction |

**Example:**
```
User: "NEVER import AWS SDK packages directly in code."
AI: 🔔 Detects zero-tolerance rule → Documents immediately
```

### ⚠️ HIGH Priority (Important Conventions)

| Signal | Example | Action |
|--------|---------|--------|
| Strong Requirement | "MUST", "REQUIRED", "ALWAYS" | High priority |
| Industry Standard | "The standard is..." | Document as pattern |
| Process Definition | "The workflow is..." | Methodology |
| Repeated Decision | Same choice 2+ times | Emerging pattern |

**Example:**
```
User: "The approach is to test locally first, then add to CI."
AI: 🔔 Detects methodology → Flags for documentation
```

### 📋 MEDIUM Priority (Guidelines)

| Signal | Example | Action |
|--------|---------|--------|
| Preference | "Prefer X over Y" | Guideline |
| Common Pattern | "We do this consistently" | Track pattern |
| Tool Choice | "We use X for Y" | Technology decision |

### 💡 LOW Priority (Monitor)

| Signal | Example | Action |
|--------|---------|--------|
| Suggestion | "Should", "Could" | Monitor for repetition |
| Question Resolution | Answer to "How should we..." | Potential pattern |

## File Structure

```
docs/
├── CONVENTION-CAPTURE-GUIDE.md           # ← This file (system guide)
├── conventions-tracking.md               # ← Central registry
├── convention-detection-patterns.md      # ← Detection reference
├── templates/
│   ├── convention-template.md           # ← Template for documenting
│   └── session-summary-template.md      # ← Template for summaries
└── examples/
    └── convention-example-agents-md.md  # ← Example implementation
```

## Workflow Examples

### Example 1: Detecting Zero-Tolerance Rule

**Scenario:** User corrects approach during code review

**Conversation:**
```
User: "NEVER use type escape hatches like 'as any' or 'as unknown'.
       Even for testing. Use proper type annotations instead."
```

**AI Detection:**
```
🔔 **CRITICAL CONVENTION DETECTED**

**Name**: No Type Escape Hatches
**Type**: Zero-tolerance Rule
**What**: Never use 'as any', 'as unknown', or other type escape hatches
**Why**: Defeats TypeScript's type safety, even in tests
**Priority**: CRITICAL
**Enforcement**: Zero-tolerance

Document now? [Y/N]
```

**User:** Y

**AI Actions:**
1. ✅ Add to `docs/conventions-tracking.md` (Pending Documentation)
2. ✅ Create task: Document in wiki
3. ✅ Note in session summary

### Example 2: Detecting Industry Standard

**Scenario:** User corrects filename during planning

**Conversation:**
```
User: "Actually, use AGENTS.md plural, not AGENT.md. That's the
       industry standard."
```

**AI Detection:**
```
🔔 **CONVENTION DETECTED**

**Name**: AGENTS.md Filename Standard
**Type**: Convention (Industry Standard)
**What**: Use AGENTS.md (plural) for AI tool context files
**Why**: Industry standard supported by OpenAI, GitHub, Google
**Priority**: HIGH
**Correction**: Was AGENT.md (singular) → AGENTS.md (plural)

Document now? [Y/N]
```

**User:** Y

**AI Actions:**
1. ✅ Update all references from AGENT.md to AGENTS.md
2. ✅ Add to `docs/conventions-tracking.md`
3. ✅ Create example documentation
4. ✅ Update related files

### Example 3: Detecting Repeated Pattern

**Scenario:** Same decision made 3 times in session

**AI Observation:**
```
Session analysis:
- File 1: Chose vendor wrapper over direct AWS SDK import
- File 2: Chose vendor wrapper over direct AWS SDK import
- File 3: Chose vendor wrapper over direct AWS SDK import

Pattern detected: Vendor wrapper preference (3 occurrences)
```

**AI Detection:**
```
🔔 **PATTERN DETECTED**

**Name**: Vendor Wrapper Preference
**Type**: Repeated Decision Pattern
**What**: Consistently using vendor wrappers instead of direct imports
**Frequency**: 3 occurrences in current session
**Context**: AWS SDK operations (S3, Lambda, DynamoDB)
**Priority**: MEDIUM

Note: This appears to reinforce existing "AWS SDK Encapsulation Policy"

Track pattern? [Y/N]
```

## Convention Lifecycle

```
┌──────────┐
│ Detected │ ← AI flags during conversation
└────┬─────┘
     ↓
┌──────────────────────┐
│ Pending Documentation│ ← Added to conventions-tracking.md
└────┬─────────────────┘
     ↓
┌────────────────────┐
│ Documented in Wiki │ ← Formal page created using template
└────┬───────────────┘
     ↓
┌──────────────────────┐
│ Recently Documented  │ ← Visible for 30 days
└────┬─────────────────┘
     ↓
┌──────────┐
│ Active   │ ← Established convention
└────┬─────┘
     ↓ (if superseded)
┌──────────┐
│ Archived │ ← Historical reference
└──────────┘
```

## Templates Reference

### Convention Documentation Template

Location: `docs/templates/convention-template.md`

**Use when:** Creating a formal wiki page for a convention

**Sections:**
- Classification (Type, Enforcement, Scope)
- The Rule (one-sentence statement)
- Context & Rationale (Problem, Origin, Benefits)
- Examples (Correct ✅ / Incorrect ❌)
- Enforcement (Detection, Automation, Consequences)
- Related Patterns
- Evolution History

**Example:** See `docs/examples/convention-example-agents-md.md`

### Session Summary Template

Location: `docs/templates/session-summary-template.md`

**Use when:** End of work session

**Sections:**
- New Conventions (what was detected)
- Updated Conventions (what changed)
- Patterns Observed
- Work Completed
- Recommended Actions
- Next Session Preparation

## Success Metrics

### Coverage
- ✅ **Zero conventions lost** to conversation history
- ✅ **100% detection rate** for explicit rules (NEVER, MUST, etc.)
- ✅ **90%+ detection rate** for patterns and methodologies

### Quality
- ✅ **Low false positive rate** (< 10%)
- ✅ **High documentation quality** (using templates)
- ✅ **Consistent format** across all conventions

### Persistence
- ✅ **AI memory across sessions** via conventions-tracking.md
- ✅ **Searchable knowledge base** in wiki
- ✅ **Clear onboarding path** for new developers

## Common Pitfalls

### ❌ Don't Flag These

**One-time decisions:**
```
User: "For this specific file, use a different import structure."
AI: ❌ Don't flag - context-specific, not generalizable
```

**Temporary workarounds:**
```
User: "Just use 'as any' here temporarily until we refactor."
AI: ❌ Don't flag - explicitly temporary
```

**Personal preferences without rationale:**
```
User: "I prefer single quotes."
AI: ❌ Don't flag - no technical reason given
```

### ✅ Do Flag These

**Explicit rules:**
```
User: "NEVER use single quotes. We enforce double quotes."
AI: ✅ Flag - explicit rule with enforcement
```

**Corrections:**
```
User: "Actually, the correct way is to use double quotes."
AI: ✅ Flag - indicates a standard exists
```

**Repeated decisions:**
```
(Same choice made 2+ times in different contexts)
AI: ✅ Flag - emerging pattern
```

## Maintenance

### Weekly
- [ ] Review pending conventions in `docs/conventions-tracking.md`
- [ ] Document high-priority conventions
- [ ] Update session summaries

### Monthly
- [ ] Move documented conventions from "Recently Documented" to archive
- [ ] Review false positives and refine detection patterns
- [ ] Update templates based on usage

### Quarterly
- [ ] Audit all conventions for relevance
- [ ] Archive superseded conventions
- [ ] Refine detection thresholds

## Integration with Existing Documentation

### Relationship to Style Guides

```
Style Guides (Prescriptive)
    ├─ lambdaStyleGuide.md      # How to write Lambda code
    ├─ testStyleGuide.md         # How to write tests
    ├─ bashStyleGuide.md         # How to write bash scripts
    └─ tofuStyleGuide.md         # How to write infrastructure

Conventions (Discovered)
    ├─ conventions-tracking.md   # What conventions we've discovered
    └─ docs/wiki/Conventions/    # Detailed convention documentation
```

**Key Difference:**
- **Style Guides**: Established rules (prescriptive)
- **Conventions**: Emergent patterns (descriptive → prescriptive)

### When to Add to Style Guides vs Conventions

**Add to Style Guide:**
- Established industry standards
- Consistent patterns used in 100% of applicable code
- Rules that should be enforced from day 1

**Add to Conventions:**
- Emerging patterns specific to this project
- Decisions made during development
- Context-specific rules

**Evolution:** Conventions that prove valuable may graduate to Style Guides

## FAQ

### Q: What if I'm not sure if something is a convention?

**A:** Use the verification questions:
1. Is this generalizable beyond the current context?
2. Does this solve a recurring problem?
3. Has this been stated with conviction?
4. Would this benefit other developers?
5. Is this consistent with existing conventions?

If 3+ are "yes", flag it. Better to flag and dismiss than miss it.

### Q: What if a convention conflicts with an existing one?

**A:** Flag it anyway, but note the conflict:
```
🔔 **CONVENTION DETECTED (CONFLICT)**

**Conflict**: Contradicts existing convention X
**Recommendation**: Discuss which convention should take precedence
```

### Q: How long should conventions stay in "Pending Documentation"?

**A:** Ideally < 1 week for HIGH priority, < 2 weeks for MEDIUM. If pending > 1 month, either document or archive.

### Q: Can conventions be updated?

**A:** Yes! Update the convention page and document in "Evolution History" section.

### Q: What about conventions that become obsolete?

**A:** Move to "Archived Conventions" in `conventions-tracking.md` with reason.

## Resources

### Files
- `docs/CONVENTION-CAPTURE-GUIDE.md` - This guide
- `docs/conventions-tracking.md` - Central registry
- `docs/convention-detection-patterns.md` - Detection reference
- `docs/templates/convention-template.md` - Documentation template
- `docs/templates/session-summary-template.md` - Summary template
- `docs/examples/convention-example-agents-md.md` - Example

### Related Documentation
- `docs/plans/github-wiki-organization.md` - Wiki organization strategy
- `docs/styleGuides/` - Established style guides
- `CLAUDE.md` - Project instructions for Claude
- `AGENTS.md` - Universal AI context file

## Support

### For AI Assistants
If uncertain about detection, err on the side of flagging. The user can always dismiss.

### For Developers
If you notice a convention that wasn't captured, add it to `docs/conventions-tracking.md` manually.

---

**Version**: 1.0
**Created**: 2025-11-22
**Status**: Active
**Estimated Setup**: 2 hours
**Ongoing Maintenance**: 15-30 min per session
