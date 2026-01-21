# Documentation Freshness Tracking

## Purpose

Assessment and evaluation documents require periodic review to remain accurate. This convention tracks document freshness via YAML frontmatter metadata.

## Metadata Format

All assessment documents include a YAML frontmatter block at the top of the file:

```yaml
---
last_updated: YYYY-MM-DD
next_review: YYYY-MM-DD
status: current | stale | archived
---
```

## Field Definitions

| Field | Description | Format |
|-------|-------------|--------|
| `last_updated` | Date the document was last meaningfully updated | ISO 8601 date (YYYY-MM-DD) |
| `next_review` | Date when the document should be reviewed | ISO 8601 date (YYYY-MM-DD) |
| `status` | Current validity of the document | `current`, `stale`, or `archived` |

## Review Schedule

| Document Type | Review Frequency | Next Review Calculation |
|---------------|------------------|------------------------|
| Security assessments | Quarterly | +3 months from last_updated |
| Architecture evaluations | Semi-annually | +6 months from last_updated |
| Tech stack audits | Annually | +12 months from last_updated |
| Framework benchmarking | Annually | +12 months from last_updated |
| Test suite audits | Semi-annually | +6 months from last_updated |

## Status Values

### current

Document reflects the current state of the system. Information is accurate and actionable.

```yaml
status: current
```

### stale

Document is due for review. Information may be outdated. Review and update before relying on it.

```yaml
status: stale
```

### archived

Historical reference only. Document has been superseded by a newer version or the subject no longer applies.

```yaml
status: archived
```

## Which Documents Need Metadata

Add freshness metadata to documents that:
- Contain assessments or audits
- Have dates in their filenames (e.g., `*-2026-01.md`)
- Evaluate current system state
- Make recommendations that may become outdated

Do NOT add freshness metadata to:
- Reference documentation (patterns, conventions)
- Tutorials and how-to guides
- Index pages and navigation

## Example Document with Metadata

```markdown
---
last_updated: 2026-01-20
next_review: 2026-07-20
status: current
---

# Security Audit Report

This document evaluates the security posture of the Media Downloader application...
```

## Review Process

### During Quarterly Reviews

1. Query documents with `next_review` dates in the past
2. For each document:
   - Review content against current system state
   - Update outdated information
   - Change `last_updated` to today
   - Calculate new `next_review` based on document type
   - Verify `status` is still accurate
3. If document is obsolete, change status to `archived`

### Finding Documents Due for Review

```bash
# Find all documents with YAML frontmatter
grep -l "^---" docs/wiki/**/*.md | while read file; do
  next_review=$(grep "next_review:" "$file" | cut -d' ' -f2)
  if [[ "$next_review" < "$(date +%Y-%m-%d)" ]]; then
    echo "Due for review: $file (next_review: $next_review)"
  fi
done
```

### When Creating New Assessments

1. Add YAML frontmatter at the top of the file
2. Set `last_updated` to today's date
3. Set `next_review` based on document type (see schedule above)
4. Set `status` to `current`

## Integration with CI

The Vale linter does not currently validate YAML frontmatter. Future enhancement could add:
- Validation that assessment documents have required metadata
- Alerts for documents past their review date
- Automated status changes based on date comparison

## Related Documentation

- [Documentation Style Guide](./Documentation-Style-Guide.md) - Writing conventions
- [Documentation Patterns](./Documentation-Patterns.md) - Page structure
- [Convention Capture System](./Convention-Capture-System.md) - How conventions are tracked

---

*Freshness tracking ensures documentation remains a reliable source of truth. When you update an assessment document, always update the metadata.*
