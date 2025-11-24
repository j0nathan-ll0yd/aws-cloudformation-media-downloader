# Development Conventions Wiki

Welcome to the centralized development conventions wiki. This wiki contains universal patterns, methodologies, and best practices that apply across TypeScript/AWS projects.

## Quick Start

- **New to the wiki?** Start with [Getting Started](Getting-Started.md)
- **Looking for specific patterns?** Use the navigation below
- **Contributing?** See [Working with AI Assistants](Meta/Working-with-AI-Assistants.md)

## Navigation

### 📋 Conventions
Core development conventions that apply universally:

- [Naming Conventions](Conventions/Naming-Conventions.md) - camelCase, PascalCase, SCREAMING_SNAKE_CASE rules
- [Git Workflow](Conventions/Git-Workflow.md) - Commit messages, NO AI attribution
- [Code Comments](Conventions/Code-Comments.md) - Git as source of truth principle
- [Import Organization](Conventions/Import-Organization.md) - ES modules, destructuring patterns

### 🎯 TypeScript
TypeScript-specific patterns and best practices:

- [Lambda Function Patterns](TypeScript/Lambda-Function-Patterns.md) - Handler organization
- [Error Handling](TypeScript/Error-Handling.md) - API Gateway vs event-driven
- [Type Definitions](TypeScript/Type-Definitions.md) - Where to put types
- [Module Best Practices](TypeScript/Module-Best-Practices.md) - Export patterns

### 🧪 Testing
Comprehensive testing strategies and patterns:

- [Jest ESM Mocking Strategy](Testing/Jest-ESM-Mocking-Strategy.md) - Transitive dependencies solution
- [Mock Type Annotations](Testing/Mock-Type-Annotations.md) - Specific vs generic types
- [Lazy Initialization Pattern](Testing/Lazy-Initialization-Pattern.md) - Defer SDK clients
- [Coverage Philosophy](Testing/Coverage-Philosophy.md) - Test YOUR code principle
- [Integration Testing](Testing/Integration-Testing.md) - LocalStack patterns

### ☁️ AWS
AWS-specific patterns and policies:

- [SDK Encapsulation Policy](AWS/SDK-Encapsulation-Policy.md) - **ZERO-TOLERANCE** vendor wrapper pattern
- [Lambda Environment Variables](AWS/Lambda-Environment-Variables.md) - Naming conventions
- [CloudWatch Logging](AWS/CloudWatch-Logging.md) - Logging patterns
- [X-Ray Integration](AWS/X-Ray-Integration.md) - Tracing patterns

### 📜 Bash
Shell scripting conventions:

- [Variable Naming](Bash/Variable-Naming.md) - snake_case vs UPPER_CASE
- [Directory Resolution](Bash/Directory-Resolution.md) - BASH_SOURCE patterns
- [User Output Formatting](Bash/User-Output-Formatting.md) - Colors and feedback
- [Error Handling](Bash/Error-Handling.md) - set -e, exit codes

### 🏗️ Infrastructure
Infrastructure as Code patterns:

- [Resource Naming](Infrastructure/Resource-Naming.md) - PascalCase for AWS
- [File Organization](Infrastructure/File-Organization.md) - Service grouping
- [Environment Variables](Infrastructure/Environment-Variables.md) - Cross-stack consistency

### 💡 Methodologies
Development methodologies and philosophies:

- [Convention Over Configuration](Methodologies/Convention-Over-Configuration.md) - Core philosophy
- [Library Migration Checklist](Methodologies/Library-Migration-Checklist.md) - Step-by-step process
- [Dependabot Resolution](Methodologies/Dependabot-Resolution.md) - Automated updates
- [Production Debugging](Methodologies/Production-Debugging.md) - Troubleshooting guide

### 🔮 Meta
Meta-documentation about the documentation system itself:

- [Working with AI Assistants](Meta/Working-with-AI-Assistants.md) - Effective AI collaboration
- [Convention Capture System](Meta/Convention-Capture-System.md) - How conventions are captured
- [Emerging Conventions](Meta/Emerging-Conventions.md) - Live append-only log
- [AI Tool Context Files](Meta/AI-Tool-Context-Files.md) - AGENTS.md, CLAUDE.md standards
- [Documentation Patterns](Meta/Documentation-Patterns.md) - Passthrough files, organization

## Key Principles

### 🚨 Zero-Tolerance Rules
These patterns have **ZERO exceptions**:
- [AWS SDK Encapsulation](AWS/SDK-Encapsulation-Policy.md) - NEVER import AWS SDK directly
- [No AI Attribution](Conventions/Git-Workflow.md#no-ai-references) - NEVER include AI references in commits
- [Git as Source of Truth](Conventions/Code-Comments.md) - NEVER explain removed code in comments

### 📈 Convention Evolution
Conventions evolve through:
1. **Detection** - Patterns emerge during development
2. **Capture** - [Convention Capture System](Meta/Convention-Capture-System.md) preserves them
3. **Documentation** - Added to this wiki
4. **Enforcement** - Automated checks where possible
5. **Refinement** - Improved based on experience

## Using This Wiki

### For AI Assistants
- Start each session by reviewing [Convention Capture System](Meta/Convention-Capture-System.md)
- Reference wiki pages from AGENTS.md using relative paths
- Flag new conventions using the detection system
- Update [Emerging Conventions](Meta/Emerging-Conventions.md) in real-time

### For Developers
- Browse by category using navigation above
- Search for specific patterns using your IDE
- Contribute new patterns via pull requests
- Report issues or gaps in documentation

### For New Projects
1. Copy AGENTS.md template with Convention Capture instructions
2. Reference this wiki for universal patterns
3. Build project-specific conventions in `docs/conventions-tracking.md`
4. Use passthrough files (CLAUDE.md, GEMINI.md) for tool compatibility

## Repository Structure

This wiki is stored in the main repository under `docs/wiki/`:
- **Version controlled** alongside code
- **PR reviewed** for quality
- **Offline accessible** via git
- **Auto-synced** to GitHub Wiki for web viewing

## Contributing

To add or update conventions:
1. Follow the [page template](Meta/Documentation-Patterns.md#page-template)
2. Include clear examples (✅ Correct / ❌ Incorrect)
3. Explain rationale and benefits
4. Add enforcement mechanisms where possible
5. Update navigation in this Home.md

## Quick Reference

| Pattern | Category | Enforcement |
|---------|----------|-------------|
| AWS SDK Encapsulation | AWS | Zero-tolerance |
| No AI in Commits | Git | Zero-tolerance |
| camelCase for variables | Naming | Required |
| Jest transitive mocking | Testing | Required |
| Git as source of truth | Comments | Required |

---

*This wiki represents accumulated institutional knowledge from development across multiple projects. It serves as the reference implementation for development conventions and is continuously updated through the Convention Capture System.*