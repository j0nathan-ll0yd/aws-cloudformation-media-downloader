# Development Conventions Wiki

Welcome to the centralized development conventions wiki. This wiki contains universal patterns, methodologies, and best practices that apply across TypeScript/AWS projects.

## Quick Start

- **New to the wiki?** Start with [Getting Started](Getting-Started.md)
- **Want to learn hands-on?** Try the [Tutorial: Create Your First Lambda](Getting-Started/Tutorial-First-Lambda.md)
- **Looking for specific patterns?** Use the navigation below
- **Contributing?** See [Working with AI Assistants](Meta/Working-with-AI-Assistants.md)

## Navigation

### 📋 Conventions
Core development conventions that apply universally:

- [Naming Conventions](Conventions/Naming-Conventions.md) - camelCase, PascalCase, SCREAMING_SNAKE_CASE rules
- [Git Workflow](Conventions/Git-Workflow.md) - Commit messages, NO AI attribution
- [Code Comments](Conventions/Code-Comments.md) - Git as source of truth principle
- [Import Organization](Conventions/Import-Organization.md) - ES modules, destructuring patterns
- [Code Formatting](Conventions/Code-Formatting.md) - Prettier, ESLint configuration
- [Function Spacing](Conventions/Function-Spacing.md) - Blank line conventions
- [Vendor Encapsulation Deep-Dive](Conventions/Vendor-Encapsulation-Deep-Dive.md) - AWS SDK wrapping patterns
- [Logging Conventions](Conventions/Logging-Conventions.md) - Structured logging standards
- [Deprecation Policy](Conventions/Deprecation-Policy.md) - How to deprecate code
- [Database Migrations](Conventions/Database-Migrations.md) - Drizzle migration patterns
- [Workaround Tracking](Conventions/Workaround-Tracking.md) - Documenting temporary fixes
- [ESLint vs MCP Validation](Conventions/ESLint-vs-MCP-Validation.md) - When to use each

### 🎯 TypeScript
TypeScript-specific patterns and best practices:

- [Lambda Function Patterns](TypeScript/Lambda-Function-Patterns.md) - Handler organization
- [Lambda Reference Index](TypeScript/Lambda-Reference-Index.md) - All 18 Lambda functions reference
- [Lambda Middleware Patterns](TypeScript/Lambda-Middleware-Patterns.md) - Wrapper functions
- [Entity Query Patterns](TypeScript/Entity-Query-Patterns.md) - Drizzle ORM query functions
- [System Library](TypeScript/System-Library.md) - Circuit breaker, retry, errors
- [External Integrations](TypeScript/External-Integrations.md) - YouTube, GitHub integrations
- [Error Handling](TypeScript/TypeScript-Error-Handling.md) - API Gateway vs event-driven
- [Type Definitions](TypeScript/Type-Definitions.md) - Where to put types
- [Module Best Practices](TypeScript/Module-Best-Practices.md) - Export patterns

### 🧪 Testing
Comprehensive testing strategies and patterns:

- [Vitest Mocking Strategy](Testing/Vitest-Mocking-Strategy.md) - Transitive dependencies solution
- [Mock Type Annotations](Testing/Mock-Type-Annotations.md) - Specific vs generic types
- [Mock Factory Patterns](Testing/Mock-Factory-Patterns.md) - Entity fixture factories
- [Lazy Initialization Pattern](Testing/Lazy-Initialization-Pattern.md) - Defer SDK clients
- [Coverage Philosophy](Testing/Coverage-Philosophy.md) - Test YOUR code principle
- [Integration Testing](Testing/Integration-Testing.md) - LocalStack patterns
- [Integration Test Coverage](Testing/Integration-Test-Coverage.md) - Coverage tracking
- [LocalStack Testing](Testing/LocalStack-Testing.md) - Local AWS emulation
- [Dependency Graph Analysis](Testing/Dependency-Graph-Analysis.md) - Test dependency mapping
- [Fixture Extraction](Testing/Fixture-Extraction.md) - Extracting test data
- [Failure Scenario Testing](Testing/Failure-Scenario-Testing.md) - Error path coverage
- [Mocking Patterns Analysis](Testing/Mocking-Patterns-Analysis.md) - Mock pattern comparison
- [Mutation Testing Guide](Testing/Mutation-Testing-Guide.md) - Mutation testing setup
- [Test Scaffolding](Testing/Test-Scaffolding.md) - MCP test generation
- [Test Suite Audit](Testing/Test-Suite-Audit.md) - Test quality assessment
- [Integration Test Audit](Testing/Integration-Test-Audit.md) - Integration test review
- [Local CI Testing](Testing/Local-CI-Testing.md) - Running CI locally

### 🏛️ Architecture
System design and code organization:

- [Architecture Overview](Architecture/Architecture-Overview.md) - System architecture at 10,000ft view
- [System Diagrams](Architecture/System-Diagrams.md) - Lambda interaction flows and ERD
- [Code Organization](Architecture/Code-Organization.md) - Directory structure rules
- [Domain Layer](Architecture/Domain-Layer.md) - Business logic separation patterns

### 🔐 Security
Security policies and assessments:

- [Security Audit Report](Security/Security-Audit-Report.md) - Latest security assessment
- [Secret Rotation Runbook](Security/Secret-Rotation-Runbook.md) - Operational procedures
- [GitHub Secrets](Security/GitHub-Secrets.md) - CI/CD secret management
- [Dependency Security](Security/Dependency-Security.md) - Supply chain security
- [Authentication Security Assessment](Security/2026-01-Authentication-Security-Assessment.md) - Auth system review
- [Better Auth Architecture](Security/Better-Auth-Architecture.md) - Session management and auth patterns

### 👁️ Observability
Monitoring, logging, and tracing:

- [Error Handling Patterns](Observability/Error-Handling-Patterns.md) - Error strategy
- [CloudWatch Alarms](Observability/CloudWatch-Alarms.md) - Alert configuration
- [Tracing Architecture](Observability/Tracing-Architecture.md) - X-Ray patterns

### 🔧 MCP Tools
Model Context Protocol server and validation:

- [MCP Setup Guide](MCP/MCP-Setup-Guide.md) - Installation and configuration
- [Convention Tools](MCP/Convention-Tools.md) - Validation tool reference
- [Tool Capability Matrix](MCP/Tool-Capability-Matrix.md) - Available MCP tools
- [GraphRAG Usage Guide](MCP/GraphRAG-Usage-Guide.md) - Semantic search usage
- [Auto-Fix](MCP/Auto-Fix.md) - Automated convention fixing
- [Template Organization](MCP/Template-Organization.md) - MCP template structure
- [Spec Compliance Assessment](MCP/Spec-Compliance-Assessment.md) - MCP protocol compliance
- [Missing Tool Recommendations](MCP/Missing-Tool-Recommendations.md) - Tool gap analysis

### ☁️ AWS
AWS-specific patterns and policies:

- [SDK Encapsulation Policy](Conventions/Vendor-Encapsulation-Policy.md) - **ZERO-TOLERANCE** vendor wrapper pattern
- [Lambda Environment Variables](AWS/Lambda-Environment-Variables.md) - Naming conventions
- [CloudWatch Logging](AWS/CloudWatch-Logging.md) - Logging patterns
- [X-Ray Integration](AWS/X-Ray-Integration.md) - Tracing patterns

### 📜 Bash
Shell scripting conventions:

- [Variable Naming](Bash/Variable-Naming.md) - snake_case vs UPPER_CASE
- [Directory Resolution](Bash/Directory-Resolution.md) - BASH_SOURCE patterns
- [User Output Formatting](Bash/User-Output-Formatting.md) - Colors and feedback
- [Error Handling](Bash/Bash-Error-Handling.md) - set -e, exit codes
- [Script Patterns](Bash/Script-Patterns.md) - Common script patterns
- [Script Index](Bash/Script-Index.md) - All project scripts

### 🏗️ Infrastructure
Infrastructure as Code patterns:

- [OpenTofu Patterns](Infrastructure/OpenTofu-Patterns.md) - IaC patterns and conventions
- [Resource Naming](Infrastructure/Resource-Naming.md) - PascalCase for AWS
- [File Organization](Infrastructure/File-Organization.md) - Service grouping
- [Environment Variables](Infrastructure/Environment-Variables.md) - Cross-stack consistency
- [CI Workflow Reference](Infrastructure/CI-Workflow-Reference.md) - GitHub Actions documentation
- [CI Coverage Matrix](Infrastructure/CI-Coverage-Matrix.md) - CI job coverage
- [Script Registry](Infrastructure/Script-Registry.md) - Infrastructure scripts
- [Bundle Size Analysis](Infrastructure/Bundle-Size-Analysis.md) - Lambda bundle optimization
- [Lambda Decorators](Infrastructure/Lambda-Decorators.md) - PowerTools decorators
- [Lambda Layers](Infrastructure/Lambda-Layers.md) - Shared Lambda layer patterns
- [Database Permissions](Infrastructure/Database-Permissions.md) - Aurora DSQL IAM
- [Documentation Validation](Infrastructure/Documentation-Validation.md) - Doc linting CI
- [Drift Prevention](Infrastructure/Drift-Prevention.md) - IaC drift detection
- [GraphRAG Automation](Infrastructure/GraphRAG-Automation.md) - Knowledge graph CI
- [OIDC AWS Authentication](Infrastructure/OIDC-AWS-Authentication.md) - GitHub Actions AWS auth
- [Staging-Production Strategy](Infrastructure/Staging-Production-Strategy.md) - Environment strategy

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
- [Documentation Coverage Matrix](Meta/Documentation-Coverage-Matrix.md) - Audit results
- [Documentation Gap Analysis](Meta/Documentation-Gap-Analysis.md) - Priority rankings
- [Documentation Structure](Meta/Documentation-Structure.md) - Wiki organization
- [GitHub Wiki Sync](Meta/GitHub-Wiki-Sync.md) - Wiki synchronization
- [MCP CI Integration](Meta/MCP-CI-Integration.md) - MCP in CI pipelines
- [Convention Workflow Recommendations](Meta/Convention-Workflow-Recommendations.md) - Process improvements
- [pnpm Migration](Meta/pnpm-Migration.md) - Package manager migration
- [Conventions Tracking](Meta/Conventions-Tracking.md) - Active project conventions
- [Documentation Style Guide](Meta/Documentation-Style-Guide.md) - Vale linter and writing style
- [Documentation Freshness](Meta/Documentation-Freshness.md) - Assessment document tracking

### 📊 Evaluations & Audits
Assessment documents and periodic reviews:

- [Wiki Framework Evaluation Final](Meta/Wiki-Framework-Evaluation-Final-2026-01.md) - Final improvement report
- [Wiki Structure Evaluation](Meta/Wiki-Structure-Evaluation-2026-01.md) - Wiki quality assessment
- [Wiki Framework Benchmarking](Meta/Wiki-Framework-Benchmarking-2026-01.md) - Industry framework comparison
- [Unit Test Architecture](Evaluation/Unit-Test-Architecture-2026-01.md) - Test architecture review
- [2025 Tech Stack Audit](Meta/2025-Tech-Stack-Audit.md) - Technology assessment
- [Logging Strategy Assessment](Meta/Logging-Strategy-Assessment-2026-01.md) - Logging review
- [Semantic Search Evaluation](Meta/Semantic-Search-Evaluation.md) - Search capability review
- [Serverless Architecture Assessment](Meta/Serverless-Architecture-Assessment.md) - Architecture review
- [API Documentation Audit](Meta/API-Documentation-Audit-2026-01-02.md) - API docs review

## Key Principles

### 🚨 Zero-Tolerance Rules
These patterns have **ZERO exceptions**:
- [AWS SDK Encapsulation](Conventions/Vendor-Encapsulation-Policy.md) - NEVER import AWS SDK directly
- [No AI Attribution](Conventions/Git-Workflow.md) - NEVER include AI references in commits
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
3. Build project-specific conventions in `docs/wiki/Meta/Conventions-Tracking.md`
4. Use passthrough files (CLAUDE.md, GEMINI.md) for tool compatibility

## Repository Structure

This wiki is stored in the main repository under `docs/wiki/`:
- **Version controlled** alongside code
- **PR reviewed** for quality
- **Offline accessible** via git
- **Auto-synced** to GitHub Wiki for web viewing

## Contributing

To add or update conventions:
1. Follow the [page template](Meta/Documentation-Patterns.md)
2. Include clear examples (Correct / Incorrect)
3. Explain rationale and benefits
4. Add enforcement mechanisms where possible
5. Update navigation in this Home.md

## Quick Reference

| Pattern | Category | Enforcement |
|---------|----------|-------------|
| AWS SDK Encapsulation | AWS | Zero-tolerance |
| No AI in Commits | Git | Zero-tolerance |
| camelCase for variables | Naming | Required |
| Vitest transitive mocking | Testing | Required |
| Git as source of truth | Comments | Required |

---

*This wiki represents accumulated institutional knowledge from development across multiple projects. It serves as the reference implementation for development conventions and is continuously updated through the Convention Capture System.*
