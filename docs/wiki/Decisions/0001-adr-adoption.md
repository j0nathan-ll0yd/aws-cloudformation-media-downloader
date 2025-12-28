# ADR-0001: Adopt Architecture Decision Records

## Status
Accepted

## Date
2025-12-27

## Context

This project has accumulated significant institutional knowledge in the form of convention documentation in `docs/wiki/`. These documents mix two types of information:

1. **Decisions**: Why we chose a particular approach (context, rationale, trade-offs)
2. **Conventions**: How to follow the approach (rules, examples, enforcement)

This mixing creates several issues:
- Difficult to understand the historical context of decisions
- Rationale is scattered and sometimes duplicated
- New team members struggle to understand "why" behind conventions
- Changes to conventions don't clearly link to the original decision

Industry best practices from AWS, Azure, and Google Cloud recommend separating architectural decisions into dedicated Architecture Decision Records (ADRs).

## Decision

We will adopt Architecture Decision Records using the MADR 4.0 minimal template with project-specific additions.

### ADR Structure
- **Location**: `docs/wiki/Decisions/`
- **Format**: MADR 4.0 minimal (Context, Decision, Consequences)
- **Numbering**: Sequential 4-digit numbers (0001, 0002, ...)
- **Naming**: `NNNN-kebab-case-title.md`

### Separation of Concerns
- **ADRs** capture the "why" (immutable after acceptance)
- **Conventions** capture the "how" (living documentation that references ADRs)

### ADR Lifecycle
1. **Proposed**: Under discussion
2. **Accepted**: Decision made and in effect
3. **Deprecated**: No longer relevant but kept for history
4. **Superseded**: Replaced by a newer ADR (with link)

### Tooling
- `pnpm run adr:new "Title"` creates new ADRs from template
- ADR index maintained in `docs/wiki/Decisions/README.md`

## Consequences

### Positive
- Clear separation of decision context from implementation guidance
- Historical record of why decisions were made
- Easier onboarding - new team members can read decision history
- Better change management - new decisions explicitly supersede old ones
- Follows industry best practices (AWS, Azure, Google Cloud recommendations)

### Negative
- Additional documentation to maintain
- Initial effort to extract existing decisions from conventions
- Must remember to create ADRs for significant decisions

## Enforcement

- Code review: Significant architectural changes should have ADRs
- Convention docs must reference their governing ADRs

## Related

- [Conventions Tracking](../Meta/Conventions-Tracking.md) - Implementation rules
- [Convention Capture System](../Meta/Convention-Capture-System.md) - How conventions are documented
- [MADR 4.0 Template](https://github.com/adr/madr)
- [AWS ADR Best Practices](https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/)
