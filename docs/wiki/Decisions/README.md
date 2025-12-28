# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) documenting significant architectural decisions made in this project.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision along with its context and consequences. ADRs focus on the "why" behind decisions, while convention documentation focuses on the "how".

## ADR Index

<!-- adrlog -->

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-adr-adoption.md) | ADR Adoption | Accepted | 2025-12-27 |
| [0002](0002-vendor-encapsulation.md) | Vendor Encapsulation | Accepted | 2019-07-23 |
| [0003](0003-testing-philosophy.md) | Testing Philosophy | Accepted | 2025-11-27 |
| [0004](0004-lazy-initialization.md) | Lazy Initialization Pattern | Accepted | 2019-07-23 |
| [0005](0005-drift-prevention.md) | Infrastructure Drift Prevention | Accepted | 2025-12-25 |
| [0006](0006-lambda-middleware.md) | Lambda Middleware Pattern | Accepted | 2025-12-18 |
| [0007](0007-error-handling-types.md) | Error Handling by Invocation Type | Accepted | 2025-12-17 |
| [0008](0008-database-migration.md) | Database Migration Strategy | Accepted | 2025-12-26 |
| [0009](0009-pii-sanitization.md) | PII Automatic Sanitization | Accepted | 2025-12-22 |
| [0010](0010-no-ai-attribution.md) | No AI Attribution in Commits | Accepted | 2025-12-16 |
| [0011](0011-type-organization.md) | Type Organization Rules | Accepted | 2025-12-17 |
| [0012](0012-remocal-testing.md) | Remocal Testing Strategy | Accepted | 2025-11-27 |

<!-- adrlogstop -->

## Creating New ADRs

Use the ADR creation script:

```bash
pnpm run adr:new "Title of your decision"
```

Or manually:
1. Copy `template.md` to `NNNN-kebab-case-title.md`
2. Fill in all sections
3. Update this index

## ADR Statuses

- **Proposed**: Under discussion, not yet accepted
- **Accepted**: Decision has been made and is in effect
- **Deprecated**: No longer relevant but kept for historical context
- **Superseded**: Replaced by a newer ADR (link to replacement)

## Related Documentation

- [Conventions Tracking](../Meta/Conventions-Tracking.md) - Implementation rules for decisions
- [Convention Capture System](../Meta/Convention-Capture-System.md) - How conventions are documented

## References

- [MADR 4.0 Template](https://github.com/adr/madr)
- [AWS ADR Best Practices](https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/)
- [Michael Nygard's Original ADR Proposal](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
