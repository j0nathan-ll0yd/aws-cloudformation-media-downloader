# Convention Detection Patterns

This document defines explicit patterns for detecting when conventions, rules, patterns, or methodologies are emerging during development work.

## Detection Signal Types

### 🚨 CRITICAL Priority Signals

These signals indicate zero-tolerance rules that must be documented immediately:

| Signal Pattern | Example Phrases | Action |
|----------------|-----------------|--------|
| **Explicit Prohibition** | "NEVER", "ABSOLUTELY FORBIDDEN", "BANNED" | Flag immediately as zero-tolerance rule |
| **Correction with Emphasis** | "Actually, it's X not Y", "The correct way is..." | High priority - captures important distinctions |
| **Zero Tolerance Language** | "Zero-tolerance", "No exceptions", "This MUST" | Critical rule that needs enforcement |
| **Security/Safety** | "Security vulnerability", "Data loss risk" | Critical - safety/security convention |

**Detection Template:**
```
🔔 **CRITICAL CONVENTION DETECTED**

**Type**: Zero-tolerance Rule
**Signal**: [Exact phrase that triggered detection]
**Convention**: [One-sentence statement]
**Enforcement**: Immediate
**Priority**: CRITICAL

Document now? [Y/N]
```

### ⚠️ HIGH Priority Signals

These signals indicate important conventions that should be documented:

| Signal Pattern | Example Phrases | Action |
|----------------|-----------------|--------|
| **Strong Requirement** | "MUST", "REQUIRED", "ALWAYS", "ALL" | High priority convention |
| **Explicit Standard** | "The standard is", "Industry practice", "Best practice" | Document as established pattern |
| **Process Definition** | "The workflow is", "The approach is" | Methodology to document |
| **Repeated Decision** | Same choice made 2+ times in session | Emerging pattern |

### 📋 MEDIUM Priority Signals

These signals suggest conventions worth tracking:

| Signal Pattern | Example Phrases | Action |
|----------------|-----------------|--------|
| **Preference Statement** | "Prefer X over Y", "Use X instead of Y" | Guideline-level convention |
| **Pattern Recognition** | "This is a common pattern", "We do this consistently" | Track as emerging pattern |
| **Tool/Library Choice** | "We use X for Y", "X is our tool for Z" | Technology decision |
| **Naming Convention** | "We call this X", "The naming pattern is" | Naming standard |

### 💡 LOW Priority Signals

These signals indicate potential conventions to monitor:

| Signal Pattern | Example Phrases | Action |
|----------------|-----------------|--------|
| **Suggestion** | "Should", "Could", "Might want to" | Monitor, may become convention |
| **Question Resolution** | Answer to "How should we..." question | Potential pattern if repeated |
| **File Organization** | "Put this in X directory" | Potential structural convention |

## Detection Examples

### Example 1: Zero-Tolerance Rule

**User Message:**
> "NEVER import AWS SDK packages directly. ALL AWS SDK usage MUST be wrapped in vendor modules."

**Detection:**
- Signal: "NEVER", "ALL", "MUST"
- Type: Zero-tolerance Rule
- Priority: CRITICAL

**Flag:**
```
🔔 **CRITICAL CONVENTION DETECTED**

**Name**: AWS SDK Encapsulation Policy
**Type**: Zero-tolerance Rule
**What**: Never import @aws-sdk/* in application code; use lib/vendor/AWS/* wrappers
**Why**: Encapsulation, type safety, testability, maintainability
**Proposed Location**: Already in CLAUDE.md, consider docs/wiki/Conventions/AWS-SDK-Encapsulation.md
**Priority**: CRITICAL
**Enforcement**: Zero-tolerance

Document in wiki? [Y/N]
```

### Example 2: Correction (High Priority)

**User Message:**
> "Actually, it's AGENTS.md plural, not AGENT.md. That's the industry standard."

**Detection:**
- Signal: "Actually, it's", "industry standard"
- Type: Correction + Standard
- Priority: HIGH

**Flag:**
```
🔔 **CONVENTION DETECTED**

**Name**: AGENTS.md Filename Standard
**Type**: Convention (Industry Standard)
**What**: Use AGENTS.md (plural) for AI coding assistant context
**Why**: Industry standard supported by 20+ AI tools
**Correction**: Was using AGENT.md (singular), corrected to plural
**Proposed Location**: docs/wiki/Meta/AI-Tool-Context-Files.md
**Priority**: HIGH

Document now? [Y/N]
```

### Example 3: Repeated Decision (Medium Priority)

**Observation:**
> User chose to use vendor wrappers instead of direct imports in 3 different files

**Detection:**
- Signal: Same decision made 3 times
- Type: Repeated Pattern
- Priority: MEDIUM

**Flag:**
```
🔔 **PATTERN DETECTED**

**Name**: Vendor Wrapper Preference
**Type**: Pattern (Repeated Decision)
**What**: Consistently choosing vendor wrappers over direct imports
**Frequency**: 3 occurrences in current session
**Context**: S3, Lambda, DynamoDB operations
**Proposed Action**: Already documented as AWS SDK Encapsulation Policy
**Priority**: MEDIUM

Note: This reinforces existing convention.
```

### Example 4: Process/Methodology (High Priority)

**User Message:**
> "The workflow is: create test script, verify locally, then add to CI/CD"

**Detection:**
- Signal: "The workflow is"
- Type: Methodology
- Priority: HIGH

**Flag:**
```
🔔 **METHODOLOGY DETECTED**

**Name**: Testing Workflow
**Type**: Methodology
**What**: Test script → Local verification → CI/CD integration
**Why**: Ensures tests work before automating them
**Proposed Location**: docs/wiki/Methodologies/Testing-Workflow.md
**Priority**: HIGH

Document now? [Y/N]
```

## Context-Specific Detection

### During Code Review
Watch for:
- "This should follow [pattern]"
- "We don't do it that way"
- "The convention here is..."

### During Planning
Watch for:
- "The approach is..."
- "We handle this by..."
- "The standard process is..."

### During Bug Fixes
Watch for:
- "This happened because we should always..."
- "The rule is to prevent..."
- "Going forward, we must..."

### During Refactoring
Watch for:
- "We're switching from X to Y"
- "The new pattern is..."
- "This is now the standard"

## False Positive Avoidance

### NOT Conventions

Don't flag these as conventions:
- ❌ One-time decisions specific to single file
- ❌ Temporary workarounds
- ❌ Personal preferences without rationale
- ❌ Context-specific solutions
- ❌ Exploratory suggestions ("maybe we could...")

### Verification Questions

Before flagging, ask:
1. Is this generalizable beyond the current context?
2. Does this solve a recurring problem?
3. Has this been stated with conviction (not just suggestion)?
4. Would this benefit other developers?
5. Is this consistent with existing conventions?

If 3+ answers are "yes", flag it.

## Integration with Workflow

### Start of Session
```markdown
1. Read docs/conventions-tracking.md
2. Review recent conventions
3. Activate detection mode
```

### During Session
```markdown
1. Monitor for detection signals
2. Flag when thresholds met
3. Confirm with user
4. Add to tracking document
```

### End of Session
```markdown
1. Generate session summary
2. Update conventions-tracking.md
3. List pending documentation
4. Propose next steps
```

## Automation Opportunities

### Potential Enhancements
- **AI Training**: Fine-tune detection on project history
- **Pattern Matching**: Regex patterns for common signals
- **Frequency Analysis**: Track repeated phrases
- **Cross-Reference**: Link to existing conventions
- **Auto-Categorization**: Suggest convention type/priority

### Current Limitations
- Manual flagging required
- No persistent detection across sessions (yet)
- No automated documentation generation (yet)

## Metrics & Improvement

### Success Metrics
- **Detection Rate**: % of conventions caught vs missed
- **False Positive Rate**: % of incorrect detections
- **Documentation Rate**: % of detected conventions documented
- **Time to Document**: Average time from detection to wiki page

### Continuous Improvement
- Review missed conventions quarterly
- Update detection patterns based on false positives
- Refine priority thresholds
- Add new signal types as discovered

---

**Version**: 1.0
**Created**: 2025-11-22
**Last Updated**: 2025-11-22
**Status**: Active
