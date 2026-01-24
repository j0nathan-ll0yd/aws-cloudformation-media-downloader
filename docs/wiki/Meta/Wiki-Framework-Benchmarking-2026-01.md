---
last_updated: 2026-01-20
next_review: 2027-01-20
status: current
---

# Wiki Framework Benchmarking - January 2026

This document benchmarks the project wiki against 12 industry documentation frameworks and methodologies, providing comparative analysis and recommendations.

## Executive Summary

The project wiki was evaluated against 12 industry documentation frameworks. The current structure demonstrates strong alignment with best practices, particularly in how-to guides and reference documentation. The primary gap identified is tutorial content for onboarding.

**Recommendation**: Adopt a hybrid framework approach combining Diátaxis (content organization), Docs-as-Code (methodology), and C4 Model (architecture visualization).

---

## Industry Framework Research

### Frameworks Analyzed

| # | Framework/Topic | Source |
|---|-----------------|--------|
| 1 | Diátaxis (Divio) | [diataxis.fr](https://diataxis.fr/) |
| 2 | Google Developer Documentation Style Guide | [developers.google.com/style](https://developers.google.com/style/) |
| 3 | Microsoft Writing Style Guide | [learn.microsoft.com/style-guide](https://learn.microsoft.com/en-us/style-guide/welcome/) |
| 4 | Write the Docs Community | [writethedocs.org](https://www.writethedocs.org/guide/index.html) |
| 5 | Docs-as-Code Methodology | [writethedocs.org/guide/docs-as-code](https://www.writethedocs.org/guide/docs-as-code/) |
| 6 | The Good Docs Project | [thegooddocsproject.dev](https://www.thegooddocsproject.dev/) |
| 7 | C4 Model | [c4model.com](https://c4model.com/) |
| 8 | arc42 Template | [arc42.org](https://arc42.org/overview) |
| 9 | README Driven Development | [tom.preston-werner.com](https://tom.preston-werner.com/2010/08/23/readme-driven-development) |
| 10 | Stripe Documentation Approach | [docs.stripe.com](https://docs.stripe.com/) |
| 11 | GitBook/Notion Comparison | [archbee.com](https://www.archbee.com/blog/notion-vs-gitbook) |
| 12 | MECE Principle & DX Metrics | [getdx.com](https://getdx.com/blog/developer-experience/) |

---

## Framework Comparison Matrix

### Content Organization Frameworks

| Framework | Focus | Key Concept | Best For | Weakness |
|-----------|-------|-------------|----------|----------|
| **Diátaxis** | Information architecture | 4 quadrants: Tutorials, How-to, Reference, Explanation | General technical docs | Requires discipline to categorize |
| **C4 Model** | Architecture visualization | 4 levels: Context, Container, Component, Code | System architecture diagrams | Narrow scope (diagrams only) |
| **arc42** | Architecture documentation | 12 modular sections | Comprehensive architecture docs | Can be heavyweight |
| **MECE Principle** | Information structure | Mutually Exclusive, Collectively Exhaustive | Organizing any content | Abstract, needs interpretation |

### Style & Methodology Frameworks

| Framework | Focus | Key Concept | Best For | Weakness |
|-----------|-------|-------------|----------|----------|
| **Google Style Guide** | Writing style | Conversational, inclusive, accessible | Consistent voice | Not an architecture framework |
| **Microsoft Style Guide** | Writing style | Warm, clear, helpful | Enterprise documentation | Very comprehensive (overwhelming) |
| **Docs-as-Code** | Workflow | Treat docs like code (git, PRs, CI) | Developer teams | Requires tooling setup |
| **README Driven Development** | Development process | Write README before code | New projects/features | Not for large doc sets |

### Template & Tool Frameworks

| Framework | Focus | Key Concept | Best For | Weakness |
|-----------|-------|-------------|----------|----------|
| **The Good Docs Project** | Templates | Pre-built doc templates | Open source projects | Must adapt templates |
| **Write the Docs Community** | Best practices | Community-vetted patterns | Learning resources | Guidance, not prescriptive |
| **Stripe Docs** | Developer experience | Interactive, personalized | API documentation | Requires engineering investment |
| **GitBook** | Documentation platform | Technical docs publishing | Public-facing docs | Platform lock-in |

---

## Detailed Framework Analysis

### 1. Diátaxis - PRIMARY FRAMEWORK RECOMMENDATION

**What it is:** A systematic framework for organizing documentation into four quadrants based on user needs.

**The Four Quadrants:**

| Quadrant | Purpose | User Mode | Wiki Examples |
|----------|---------|-----------|---------------|
| **Tutorials** | Learning-oriented, guided lessons | "I want to learn" | Getting-started guides |
| **How-to Guides** | Task-oriented, problem-solving | "I want to accomplish X" | Lambda-Function-Patterns, Vitest-Mocking-Strategy |
| **Reference** | Information-oriented, accurate descriptions | "I need to look up Y" | Lambda-Reference-Index, Type-Definitions |
| **Explanation** | Understanding-oriented, background context | "I want to understand why" | Domain-Layer, Convention-Capture-System |

**Why Diátaxis is relevant:**
- Used by Gatsby, Cloudflare, Django, and major projects
- Addresses the "weak tutorials" gap identified in this evaluation
- Provides clear categorization criteria

**Current Wiki Alignment:**

| Quadrant | Current Coverage | File Count | Assessment |
|----------|-----------------|------------|------------|
| Tutorials | Minimal | ~2 files | **Weak** - Primary gap |
| How-to Guides | Strong | 40+ files | Strong |
| Reference | Strong | 50+ files | Strong |
| Explanation | Moderate | 15+ files | Adequate |

---

### 2. Docs-as-Code - METHODOLOGY RECOMMENDATION

**What it is:** A philosophy treating documentation like code: version control, peer review, CI/CD.

**Core Principles:**
- Store docs in git alongside code
- Use markdown/plain text formats
- Subject to PR review process
- Automate testing and deployment

**Current Implementation Status:**

| Principle | Status | Implementation |
|-----------|--------|----------------|
| Git version control | Implemented | All docs in `docs/wiki/` |
| Markdown format | Implemented | 100% markdown files |
| PR review process | Implemented | All changes via PR |
| Automated validation | Implemented | MCP convention validation |
| Staleness detection | Partial | Manual review needed |
| GitHub Wiki sync | Implemented | GitHub Actions workflow |

---

### 3. C4 Model - ARCHITECTURE VISUALIZATION

**What it is:** A lean graphical notation for software architecture at 4 zoom levels.

**The Four Levels:**

| Level | Scope | Audience | Wiki Application |
|-------|-------|----------|------------------|
| **Context** | System + external dependencies | All stakeholders | AGENTS.md system diagrams |
| **Container** | High-level internal components | Technical staff | Lambda flow diagrams |
| **Component** | Internals of each container | Developers | Entity relationships |
| **Code** | Class-level detail | Developers | Rarely needed |

**Relevance to Wiki:**
- Architecture/ category has limited content (2-3 files)
- C4 diagrams would strengthen architecture documentation
- Already using Mermaid diagrams in AGENTS.md following C4 principles

---

### 4. arc42 Template

**What it is:** A comprehensive 12-section template for architecture documentation.

**12 Sections:**
1. Introduction and Goals
2. Constraints
3. Context and Scope
4. Solution Strategy
5. Building Block View
6. Runtime View
7. Deployment View
8. Crosscutting Concepts
9. Architecture Decisions
10. Quality Requirements
11. Risks and Technical Debt
12. Glossary

**Assessment:** More heavyweight than needed for current wiki. Could inform future Architecture-Overview.md structure. Sections like "Architecture Decisions" align with existing ADR patterns.

---

### 5. Google Developer Documentation Style Guide

**What it is:** Writing style guidelines for technical documentation.

**Key Principles:**
- Conversational, friendly tone
- Write for global audiences
- Accessibility compliance
- Inclusive language

**Relevance:**
- Complements Diátaxis (content architecture vs. writing style)
- Could inform a future wiki style guide
- Available as Vale linter rules: [github.com/errata-ai/Google](https://github.com/errata-ai/Google)

---

### 6. The Good Docs Project

**What it is:** Open-source templates for common documentation types.

**Available Templates:**
- Quickstarts, READMEs, Reference articles
- Release notes, Style guides
- Code of Conduct, Bug reports
- API getting started

**Relevance:**
- Templates could accelerate filling identified gaps
- Tutorial content could use their Quickstart template
- Troubleshooting guides could use their patterns

---

### 7. Stripe Documentation Approach

**What it is:** Best-in-class developer documentation with interactive features.

**Key Features:**
- Personalized code examples with user's API keys
- Language-switching across all examples
- Embedded Shell for live API testing
- "Friction logging" for documentation improvement

**Relevance:**
- Aspirational for API documentation
- "Friction logging" could improve wiki maintenance
- Currently beyond scope for internal wiki

---

### 8. MECE Principle

**What it is:** McKinsey's framework for organizing information without gaps or overlaps.

**Application to Documentation:**
- **Mutually Exclusive:** No duplicate content across pages
- **Collectively Exhaustive:** All topics covered

**Current Wiki Assessment:**
<!-- vale Google.FirstPerson = NO -->
- **ME (No overlap):** No significant redundancy detected
- **CE (Complete):** Gaps exist (tutorials, architecture overview)
<!-- vale Google.FirstPerson = YES -->

---

## Recommendation: Hybrid Framework Approach

Based on the comparative analysis, the wiki should adopt a **hybrid approach** combining:

### Primary: Diátaxis for Content Organization
- Continue using the 4-quadrant model for content categorization
- Address the tutorial gap as highest priority
- Maintain strong how-to and reference coverage

### Methodology: Docs-as-Code (Already Implemented)
- Continue git-based documentation workflow
- Enhance with automated freshness checks
- Add "Last Updated" metadata to assessment documents

### Architecture: C4 Model Inspiration
- Use C4 levels for architecture documentation
- Create Context and Container diagrams for Lambda interactions
- Keep detailed code-level docs in TypeScript/ category

### Templates: Good Docs Project Patterns
- Adopt their Quickstart template for tutorial content
- Use their README template patterns
- Consider their Troubleshooting template

### Style: Google Style Guide Principles
- Apply conversational, inclusive tone guidelines
- Consider adding Vale linter for style enforcement
- Ensure accessibility compliance

---

## Current Wiki Scores with Framework Context

| Criterion | Score | Framework Benchmark | Assessment |
|-----------|-------|---------------------|------------|
| Organization | 8/10 | Diátaxis 4-quadrant | Tutorials weak, others strong |
| Navigation | 9/10 | Industry standard | No major gap |
| Content Quality | 8.5/10 | Google/Microsoft style | Could add style linting |
| Maintenance | 8/10 | Docs-as-Code best practices | Need freshness automation |
| AI Optimization | 9.5/10 | Industry-leading | Ahead of most projects |
| Diátaxis Alignment | 7/10 | Diátaxis framework | Tutorial gap critical |
| **Overall** | **8.3/10** | - | Strong foundation |

---

## Implementation Phases

### Phase 1: Tutorial Gap (HIGH Priority)
1. Create `docs/wiki/Getting-Started/` category
2. Add first Lambda tutorial using Good Docs Quickstart template
3. Target: Move Diátaxis alignment from 7/10 to 8/10

### Phase 2: Architecture Enhancement (MEDIUM Priority)
1. Create `docs/wiki/Architecture/Architecture-Overview.md`
2. Use C4 Context and Container diagram concepts
3. Include Mermaid diagrams from AGENTS.md as starting point

### Phase 3: Style Enforcement (LOW Priority)
1. Evaluate adding Vale linter with Google style rules
2. Add to pre-commit hooks
3. Document style guide in wiki

---

## Critical Gaps Identified

| Gap | Priority | Framework Reference | Recommendation |
|-----|----------|---------------------|----------------|
| Tutorial content | HIGH | Diátaxis Tutorials quadrant | Create Getting-Started guides |
| Architecture overview | MEDIUM | C4 Context/Container levels | Create Architecture-Overview.md |
| Style guide | LOW | Google Style Guide | Consider Vale linter |
| Freshness tracking | LOW | Docs-as-Code | Add "Last Updated" metadata |

---

## Sources

- [Diátaxis](https://diataxis.fr/) - Primary content organization framework
- [Google Developer Documentation Style Guide](https://developers.google.com/style/) - Writing style reference
- [Microsoft Writing Style Guide](https://learn.microsoft.com/en-us/style-guide/welcome/) - Enterprise style reference
- [Write the Docs](https://www.writethedocs.org/guide/index.html) - Community best practices
- [Docs as Code](https://www.writethedocs.org/guide/docs-as-code/) - Methodology documentation
- [The Good Docs Project](https://www.thegooddocsproject.dev/) - Template library
- [C4 Model](https://c4model.com/) - Architecture diagramming
- [arc42](https://arc42.org/overview) - Architecture documentation template
- [README Driven Development](https://tom.preston-werner.com/2010/08/23/readme-driven-development) - Development methodology
- [Stripe Documentation](https://docs.stripe.com/) - Best-in-class developer docs example
- [GitBook vs Notion](https://www.archbee.com/blog/notion-vs-gitbook) - Platform comparison
- [Developer Experience Metrics](https://getdx.com/blog/developer-experience/) - DX evaluation criteria

---

## Related Documentation

- [Documentation Coverage Matrix](Documentation-Coverage-Matrix.md)
- [Documentation Gap Analysis](Documentation-Gap-Analysis.md)
- [Documentation Structure](Documentation-Structure.md)
- [Conventions Tracking](Conventions-Tracking.md)
