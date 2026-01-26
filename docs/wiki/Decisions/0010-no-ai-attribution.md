# ADR-0010: No AI Attribution in Commits

## Status
Accepted

## Date
2025-12-16

## Context

AI coding assistants (Claude Code, GitHub Copilot, etc.) often add attribution to commits:
- "Generated with [Claude Code]"
- "Co-Authored-By: Claude <noreply@anthropic.com>"
- Robot emojis

Issues with AI attribution:
1. **Professionalism**: Industry standard is human-authored commits
2. **Code Ownership**: Unclear accountability when AI is credited
3. **Commit Noise**: Extra metadata adds no value
4. **Legal/IP Concerns**: Some organizations prohibit AI attribution

## Decision

**ZERO TOLERANCE for AI references in commits, PRs, and code.**

### Forbidden Patterns
- ❌ "Generated with [Claude Code]"
- ❌ "Co-Authored-By: Claude <noreply@anthropic.com>"
- ❌ Any mention of AI tool names or terms like "generated"
- ❌ Robot emojis (🤖) or any emojis in commits
- ❌ ANY attribution to AI tools

### Required Format
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
<type>(<scope>): <subject>
```

Examples:
```bash
git commit -m "feat: add S3 upload retry mechanism"
git commit -m "fix: resolve Lambda timeout in webhook handler"
git commit -m "refactor: extract validation logic"
```

### Enforcement
Git hook (`commit-msg`) blocks commits containing:
- "Generated with Claude"
- "Co-Authored-By: Claude"
- "Co-Authored-By:.*Anthropic"
- "AI-generated"
- Robot emoji (🤖)

## Consequences

### Positive
- Professional commit history
- Clear human accountability
- Clean, readable git log
- No legal/IP ambiguity
- Industry-standard practices

### Negative
- Requires vigilance when using AI assistants
- Must edit AI-generated commit messages
- Some developers prefer transparency about AI use

## Enforcement

| Method | Purpose |
|--------|---------|
| Git hook `commit-msg` | Blocks AI attribution patterns |
| Code review | Verify clean commit messages |
| PR template | Checklist includes "no AI references" |

## Related

- [Git Workflow](../Conventions/Git-Workflow.md) - Full workflow guide
- [Code Comments](../Conventions/Code-Comments.md) - No AI in code either
