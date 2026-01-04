# Comprehensive Project Evaluation Plan

## Executive Summary

This document provides **Claude instance prompts** for comprehensively evaluating every aspect of the AWS CloudFormation Media Downloader project. Each section contains context from web research and exploration, followed by evaluation prompts.

---

## Table of Contents

1. [Testing Infrastructure](#1-testing-infrastructure)
2. [Documentation System](#2-documentation-system)
3. [Infrastructure as Code](#3-infrastructure-as-code-opentofu)
4. [Shell Scripts](#4-shell-scripts-bin)
5. [Dependencies](#5-dependencies-packagejson)
6. [AI Agent Helpers](#6-ai-agent-helpers-mcp-claude-commands)
7. [Source Code Architecture](#7-source-code-architecture)
8. [Security & Supply Chain](#8-security--supply-chain)
9. [Build & Bundling](#9-build--bundling)
10. [Observability & Monitoring](#10-observability--monitoring)

---

## 1. Testing Infrastructure

### Current State Summary

**Stack:**
- Vitest 4.0.16 with aws-sdk-client-mock 4.1.0
- Stryker 9.4.0 for mutation testing
- LocalStack for integration tests
- 17 Lambda unit test files (2,896 lines)
- 13 workflow integration tests (3,314 lines)

**Key Files:**
- `vitest.config.mts`, `vitest.integration.config.mts`
- `stryker.config.json`
- `test/helpers/` (aws-sdk-mock.ts, entity-fixtures.ts, event-factories.ts)
- `test/integration/globalSetup.ts` (worker schema isolation)

**Patterns:**
- aws-sdk-client-mock for type-safe AWS mocking
- Factory functions for entity fixtures
- Worker-specific PostgreSQL schemas for parallel integration tests
- 8 custom ESLint rules for testing conventions

### Web Research Context

**2025 Best Practices:**
- [aws-sdk-client-mock](https://github.com/m-radzikowski/aws-sdk-client-mock) is AWS-recommended for SDK v3 testing
- [Stryker mutation testing](https://stryker-mutator.io/) with incremental mode for CI efficiency
- [LocalStack VS Code integration](https://aws.amazon.com/blogs/aws/accelerate-serverless-testing-with-localstack-integration-in-vs-code-ide/) (September 2025)
- Coverage analysis `perTest` mode for smart mutation targeting

---

### Claude Evaluation Prompts

#### Prompt 1.1: Unit Test Coverage Analysis

```
You are evaluating the unit testing infrastructure of an AWS serverless project.

CONTEXT:
- 17 Lambda functions with dedicated unit tests in src/lambdas/*/test/index.test.ts
- Test helpers in test/helpers/ (aws-sdk-mock.ts, entity-fixtures.ts, event-factories.ts)
- Vitest 4.0.16 with aws-sdk-client-mock integration
- Custom ESLint rules enforce mocking patterns

TASK:
1. Read the vitest.config.mts and understand the test configuration
2. Read 5 different Lambda test files to identify patterns and inconsistencies
3. Read all test helper files to understand mocking utilities
4. Analyze:
   - Are all transitive dependencies properly mocked?
   - Do tests follow the factory pattern consistently?
   - Are edge cases (error handling, validation) covered?
   - Do tests avoid testing implementation details?
5. Compare against 2025 best practices from aws-sdk-client-mock documentation

DELIVERABLE:
- Coverage gap analysis with specific file:line references
- Pattern consistency report
- Recommendations prioritized by impact
```

#### Prompt 1.2: Mutation Testing Effectiveness

```
You are evaluating mutation testing configuration and effectiveness.

CONTEXT:
- Stryker 9.4.0 with vitest-runner and typescript-checker
- Configuration: stryker.config.json
- Thresholds: high=60, low=40, break=35
- Mutates: src/lambdas/**/src/**/*.ts, src/entities/**/*.ts, src/lib/**/*.ts
- Excludes: src/mcp/**, src/lib/vendor/**

TASK:
1. Read stryker.config.json
2. Analyze whether mutation thresholds are appropriate for the codebase
3. Evaluate exclusion patterns - are critical paths excluded?
4. Review incremental mode configuration for CI efficiency
5. Compare against 2025 Stryker best practices:
   - Is coverageAnalysis: 'perTest' configured for performance?
   - Are timeouts appropriate for Lambda functions?
   - Is the mutator configuration optimal for TypeScript?

DELIVERABLE:
- Mutation testing configuration assessment
- Threshold appropriateness analysis
- Recommended configuration improvements
```

#### Prompt 1.3: Integration Test Architecture

```
You are evaluating the integration testing infrastructure.

CONTEXT:
- LocalStack for AWS service emulation
- 13 workflow-based integration tests in test/integration/workflows/
- Worker-specific PostgreSQL schemas for parallel isolation
- globalSetup.ts creates/migrates schemas per worker
- Integration tests validate multi-service orchestration

TASK:
1. Read test/integration/globalSetup.ts and test/integration/setup.ts
2. Read 3 workflow integration tests to understand patterns
3. Analyze the worker schema isolation approach
4. Evaluate:
   - Is the schema isolation approach robust for parallel execution?
   - Are Aurora DSQL → PostgreSQL adaptations complete?
   - Do tests properly clean up resources?
   - Are all Lambda triggers tested (API Gateway, SQS, S3, Schedule)?
5. Compare against AWS + LocalStack VS Code integration (2025) patterns

DELIVERABLE:
- Integration test coverage map (which triggers tested)
- Isolation mechanism assessment
- Gaps in multi-service flow testing
```

#### Prompt 1.4: Test Helper Utility Analysis

```
You are evaluating the test helper utilities for consistency and completeness.

CONTEXT:
- test/helpers/aws-sdk-mock.ts - AWS SDK v3 mock helpers
- test/helpers/entity-fixtures.ts - Entity factory functions
- test/helpers/event-factories.ts - Lambda event factories
- test/helpers/aws-response-factories.ts - AWS response mocks
- test/helpers/better-auth-mock.ts - Authentication mocks

TASK:
1. Read all files in test/helpers/
2. Analyze:
   - Do entity fixtures cover all Drizzle schema fields?
   - Do event factories support all Lambda trigger types?
   - Are AWS response factories type-safe and complete?
   - Is the Better Auth mock sufficient for auth flows?
3. Check for missing helpers by reading Lambda tests that don't use helpers

DELIVERABLE:
- Helper coverage analysis
- Type safety assessment
- Missing helper recommendations
```

#### Prompt 1.5: Test Documentation and Patterns

```
You are evaluating test documentation and pattern enforcement.

CONTEXT:
- docs/wiki/Testing/ contains 15 documentation files
- 8 custom ESLint rules enforce testing patterns
- Conventions documented in docs/wiki/Meta/Conventions-Tracking.md

TASK:
1. Read docs/wiki/Testing/Vitest-Mocking-Strategy.md
2. Read docs/wiki/Testing/Coverage-Philosophy.md
3. Read docs/wiki/Testing/Mock-Type-Annotations.md
4. Read eslint-local-rules/rules/use-entity-mock-helper.cjs
5. Verify documentation matches actual implementation
6. Check for pattern drift between documentation and code

DELIVERABLE:
- Documentation accuracy assessment
- Pattern enforcement gap analysis
- Recommendations for documentation updates
```

---

## 2. Documentation System

### Current State Summary

**Structure:**
- `docs/wiki/` - 60+ markdown files in 18 categories
- `AGENTS.md` - Universal AI context (compatible with 20+ tools)
- `docs/llms.txt` - AI crawler index
- Generated docs: TSDoc, terraform-docs, OpenAPI

**AI Context Files:**
- `AGENTS.md` (universal), `CLAUDE.md` (passthrough), `.gemini/instructions.md`
- `repomix-output.xml` (full codebase context)
- `docs/llms-full.txt` (concatenated wiki)

**Validation:**
- `bin/validate-docs.sh`, `bin/validate-doc-sync.sh`
- `docs/doc-code-mapping.json` for consistency checking

### Web Research Context

**2025 Best Practices:**
- [AGENTS.md standard](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/) for AI tool compatibility
- [Repomix](https://repomix.com/) for AI-friendly codebase packaging
- Multi-layer context approach (universal + tool-specific)

---

### Claude Evaluation Prompts

#### Prompt 2.1: Documentation Completeness Audit

```
You are auditing documentation completeness for an AWS serverless project.

CONTEXT:
- docs/wiki/ contains 60+ files across 18 categories
- Categories: Conventions (14), Meta (14), Testing (15), TypeScript (7), Infrastructure (11), AWS (4), Bash (8), MCP (4), Architecture (2)
- Documentation covers: Lambda patterns, testing strategies, naming conventions, security

TASK:
1. Read docs/wiki/Home.md to understand navigation structure
2. Read docs/wiki/Meta/Documentation-Structure.md
3. Sample 10 wiki pages across different categories
4. For each Lambda in src/lambdas/, verify documentation exists
5. Identify gaps:
   - Undocumented Lambda functions
   - Missing convention documentation
   - Outdated patterns (compare docs to code)

DELIVERABLE:
- Documentation coverage matrix
- Gap analysis with priority rankings
- Specific pages needing updates
```

#### Prompt 2.2: AI Context Optimization

```
You are evaluating AI context optimization for Claude Code and other AI tools.

CONTEXT:
- AGENTS.md is the universal AI context file (single source of truth)
- CLAUDE.md passthrough file points to AGENTS.md
- .gemini/instructions.md for Gemini compatibility
- repomix for codebase packing
- LanceDB for semantic search (pnpm run index:codebase)

TASK:
1. Read AGENTS.md thoroughly
2. Read .gemini/instructions.md
3. Evaluate against 2025 AI context best practices:
   - Is context properly layered (universal → tool-specific)?
   - Is critical information front-loaded?
   - Are anti-patterns clearly documented?
   - Is the convention capture system effective?
4. Test semantic search by running: pnpm run search:codebase "error handling"

DELIVERABLE:
- AI context effectiveness assessment
- Recommendations for improving AI comprehension
- Suggested AGENTS.md restructuring
```

#### Prompt 2.3: Convention Capture System

```
You are evaluating the Convention Capture System effectiveness.

CONTEXT:
- docs/wiki/Meta/Convention-Capture-System.md documents the system
- docs/wiki/Meta/Conventions-Tracking.md is the central registry
- 18 MCP validation rules enforce conventions
- Detection signals: CRITICAL (NEVER), HIGH (MUST), MEDIUM (Prefer)

TASK:
1. Read docs/wiki/Meta/Convention-Capture-System.md
2. Read docs/wiki/Meta/Conventions-Tracking.md
3. Verify all CRITICAL conventions have automated enforcement
4. Check for conventions not in tracking file but enforced in code
5. Evaluate:
   - Is the capture workflow practical?
   - Are severity levels appropriate?
   - Is enforcement consistent across tools (MCP, ESLint, hooks)?

DELIVERABLE:
- Convention coverage assessment
- Enforcement gap analysis
- Workflow improvement recommendations
```

#### Prompt 2.4: API Documentation Quality

```
You are evaluating API documentation quality and completeness.

CONTEXT:
- TypeSpec in tsp/ generates OpenAPI spec
- docs/api/openapi.yaml is the generated spec
- docs/api/index.html is SwaggerUI
- TypeScript types in src/types/

TASK:
1. Read tsp/ directory structure and main.tsp
2. Read docs/api/openapi.yaml
3. Compare TypeSpec definitions to actual Lambda handlers
4. Verify all API endpoints are documented
5. Check for:
   - Missing request/response schemas
   - Inconsistent error codes
   - Outdated endpoint documentation

DELIVERABLE:
- API documentation completeness report
- TypeSpec ↔ Implementation alignment analysis
- Recommended TypeSpec improvements
```

#### Prompt 2.5: Wiki Cross-Reference Validation

```
You are validating wiki cross-references and link integrity.

CONTEXT:
- Wiki pages use [[Page-Name]] style links
- docs/doc-code-mapping.json maps docs to code
- bin/validate-doc-sync.sh validates consistency

TASK:
1. Read docs/doc-code-mapping.json
2. Sample 20 wiki pages and verify all links work
3. Check code references in documentation against actual code
4. Verify bin/validate-doc-sync.sh catches all drift types
5. Identify orphaned documentation (not linked from anywhere)

DELIVERABLE:
- Link integrity report
- Orphan page list
- Doc-code drift instances
```

---

## 3. Infrastructure as Code (OpenTofu)

### Current State Summary

**Structure:**
- 25 .tf files in terraform/ (flat, Lambda-centric organization)
- No modules, variables.tf, or outputs.tf
- Local state (terraform.tfstate in repo - anti-pattern)
- SOPS integration for secrets

**AWS Resources:**
- 15 Lambda functions
- Aurora DSQL (serverless PostgreSQL)
- API Gateway with custom authorizer
- S3, SQS, EventBridge, SNS, CloudFront, DynamoDB (idempotency)

**Gaps Identified:**
- No multi-environment support (production only)
- No remote state backend
- No Terraform modules (repeated patterns)
- Missing outputs for deployed resources

### Web Research Context

**2025 Best Practices:**
- [OpenTofu best practices](https://terramate.io/rethinking-iac/terraform-and-opentofu-best-practices/) - state encryption, module composition
- Remote state with S3 + DynamoDB locking
- [OpenTofu native state encryption](https://medium.com/@kirann.bobby/terraform-vs-opentofu-the-key-developments-reshaping-infrastructure-as-code-in-2025-5b68aa7bcf80) (2025 feature)
- Drift detection via scheduled terraform plan

---

### Claude Evaluation Prompts

#### Prompt 3.1: Infrastructure Organization Assessment

```
You are evaluating OpenTofu infrastructure organization.

CONTEXT:
- terraform/ contains 25 .tf files (flat structure)
- No separate variables.tf, outputs.tf, locals.tf
- Each Lambda has dedicated .tf file with IAM role, policies, function
- No Terraform modules for code reuse

TASK:
1. Read terraform/main.tf for provider and common resources
2. Read 5 Lambda .tf files (list_files.tf, register_user.tf, etc.)
3. Identify repeated patterns that should be modularized
4. Evaluate against 2025 OpenTofu best practices:
   - Is the flat structure appropriate for this project size?
   - Should Lambda resources be extracted to a module?
   - Are locals used effectively?

DELIVERABLE:
- Organization pattern analysis
- Module extraction recommendations
- Refactoring priority list
```

#### Prompt 3.2: State Management Analysis

```
You are evaluating Terraform state management configuration.

CONTEXT:
- Local state files in terraform/ (terraform.tfstate, terraform.tfstate.backup)
- State files are ~2.8MB
- No remote backend configured
- No state locking mechanism

TASK:
1. Analyze risks of local state management
2. Design remote state configuration for S3 + DynamoDB
3. Evaluate OpenTofu native state encryption options (2025 feature)
4. Consider multi-environment state isolation

DELIVERABLE:
- Risk assessment of current approach
- Remote state migration plan
- Encryption recommendations
```

#### Prompt 3.3: IAM and Security Configuration

```
You are evaluating IAM and security configuration in infrastructure.

CONTEXT:
- Common policies: CommonLambdaLogging, CommonLambdaXRay, LambdaDSQLAccess
- Each Lambda has dedicated IAM role
- Aurora DSQL uses IAM authentication
- SOPS for secrets management

TASK:
1. Read terraform/main.tf IAM policy definitions
2. Read 5 Lambda IAM configurations
3. Evaluate least-privilege adherence
4. Check for overly permissive policies
5. Verify SOPS integration is secure

DELIVERABLE:
- IAM privilege assessment
- Overly permissive policy list
- Security improvement recommendations
```

#### Prompt 3.4: Resource Tagging and Cost Management

```
You are evaluating resource tagging and cost management.

CONTEXT:
- common_tags defined in main.tf (Environment, ManagedBy)
- S3 intelligent tiering: Archive after 90 days, Deep Archive after 180 days
- Lambda reserved concurrency for cost control
- No budget alerts configured

TASK:
1. Read all resource tag configurations
2. Evaluate tagging strategy completeness
3. Analyze cost optimization configurations
4. Identify missing cost controls

DELIVERABLE:
- Tagging strategy assessment
- Cost optimization recommendations
- Budget alert configuration suggestions
```

#### Prompt 3.5: Drift Detection and Deployment Safety

```
You are evaluating deployment safety and drift detection.

CONTEXT:
- bin/pre-deploy-check.sh validates before deployment
- bin/verify-state.sh for post-deploy verification
- bin/aws-audit.sh for infrastructure audit
- ManagedBy tag enforcement

TASK:
1. Read bin/pre-deploy-check.sh
2. Read bin/verify-state.sh
3. Read bin/aws-audit.sh
4. Evaluate drift detection coverage
5. Check for missing safety validations

DELIVERABLE:
- Deployment safety assessment
- Drift detection gap analysis
- Recommended safety improvements
```

---

## 4. Shell Scripts (bin/)

### Current State Summary

**23 Scripts:**
- CI/CD: ci-local.sh, ci-local-full.sh, cleanup.sh
- Testing: test-*.sh, test-integration.sh
- Documentation: document-source.sh, document-api.sh, validate-docs.sh
- Infrastructure: pre-deploy-check.sh, verify-state.sh, aws-audit.sh
- Utilities: update-yt-dlp.sh, update-youtube-cookies.sh

**Patterns:**
- `set -e` for fail-fast
- Color-coded output
- Step counting and progress tracking
- Silent mode for CI

### Web Research Context

**2025 Best Practices:**
- [Shell script error handling](https://www.gnu.org/software/bash/manual/html_node/The-Set-Builtin.html) - set -euo pipefail
- shfmt for consistent formatting
- Portable scripts avoiding bashisms where possible

---

### Claude Evaluation Prompts

#### Prompt 4.1: Script Quality and Safety Audit

```
You are auditing shell script quality and safety.

CONTEXT:
- 23 scripts in bin/
- Scripts formatted with shfmt (pnpm run format:bash)
- Used for CI, testing, deployment, utilities

TASK:
1. Read bin/cleanup.sh (comprehensive example)
2. Read bin/ci-local.sh and bin/ci-local-full.sh
3. Audit for:
   - set -e / set -euo pipefail usage
   - Proper error handling
   - Shellcheck compliance
   - Portable vs. bash-specific constructs
4. Check for hardcoded secrets or paths

DELIVERABLE:
- Script quality matrix
- Security findings
- Improvement recommendations
```

#### Prompt 4.2: CI Script Consistency

```
You are evaluating CI script consistency and coverage.

CONTEXT:
- ci-local.sh - Fast CI checks (~2-3 min)
- ci-local-full.sh - Full CI with integration tests
- cleanup.sh - Comprehensive validation (30 steps)

TASK:
1. Read all three CI-related scripts
2. Compare step coverage between scripts
3. Identify gaps between local CI and GitHub Actions
4. Evaluate script execution time optimizations

DELIVERABLE:
- CI coverage comparison matrix
- Gap analysis between local and remote CI
- Performance optimization suggestions
```

#### Prompt 4.3: Documentation Script Validation

```
You are validating documentation generation and validation scripts.

CONTEXT:
- document-source.sh - TSDoc generation
- document-api.sh - OpenAPI generation
- validate-docs.sh - Documentation validation
- validate-doc-sync.sh - Doc-code consistency

TASK:
1. Read all documentation-related scripts
2. Trace the documentation generation workflow
3. Verify validation catches all drift types
4. Check integration with CI pipeline

DELIVERABLE:
- Documentation workflow analysis
- Validation coverage assessment
- Missing validation recommendations
```

#### Prompt 4.4: Deployment Script Safety

```
You are evaluating deployment script safety mechanisms.

CONTEXT:
- pre-deploy-check.sh - Pre-deployment validation
- verify-state.sh - Post-deployment verification
- aws-audit.sh - Infrastructure audit
- update-*.sh - Binary and config updates

TASK:
1. Read all deployment-related scripts
2. Identify safety checks performed
3. Evaluate rollback capabilities
4. Check for destructive operation safeguards

DELIVERABLE:
- Safety mechanism inventory
- Rollback capability assessment
- Missing safeguard recommendations
```

#### Prompt 4.5: Script Maintainability Analysis

```
You are analyzing script maintainability and documentation.

CONTEXT:
- Scripts use color-coded output patterns
- Some scripts have header comments, others don't
- docs/wiki/Bash/ contains 8 style guides

TASK:
1. Read docs/wiki/Bash/Script-Patterns.md
2. Compare script implementations to documented patterns
3. Identify inconsistencies
4. Evaluate inline documentation quality

DELIVERABLE:
- Pattern adherence report
- Documentation consistency analysis
- Standardization recommendations
```

---

## 5. Dependencies (package.json)

### Current State Summary

**Production Dependencies (28):**
- AWS SDK v3 (8 clients, all pinned to 3.958.0)
- Lambda Powertools (logger, metrics, tracer, parser, idempotency)
- Drizzle ORM + drizzle-zod
- Better Auth, jose, zod
- OpenTelemetry instrumentation
- apns2, axios, uuid

**Dev Dependencies (47):**
- Testing: vitest, aws-sdk-client-mock, stryker
- Build: esbuild, tsx, typescript
- Quality: eslint, dprint, husky
- AI: @lancedb/lancedb, fastembed, repomix
- TypeSpec compiler and emitters

**Security:**
- pnpm lifecycle scripts disabled (.npmrc)
- Only @lancedb/lancedb and onnxruntime-node allowed to run scripts

### Web Research Context

**2025 Best Practices:**
- [pnpm v10 security](https://pnpm.io/blog/2025/12/05/newsroom-npm-supply-chain-security) - lifecycle script protection
- [Shai-Hulud npm attack](https://snyk.io/articles/npm-security-best-practices-shai-hulud-attack/) (November 2025)
- minimumReleaseAge, trustPolicy, blockExoticSubdeps settings

---

### Claude Evaluation Prompts

#### Prompt 5.1: Dependency Security Audit

```
You are auditing dependency security configuration.

CONTEXT:
- pnpm 10.0.0 with lifecycle scripts disabled
- .npmrc configures allowlist for scripts
- 75 dependencies (28 prod, 47 dev)
- AWS SDK clients pinned to 3.958.0

TASK:
1. Read package.json dependencies
2. Read .npmrc configuration
3. Evaluate against 2025 npm supply chain best practices:
   - Is lifecycle script protection properly configured?
   - Are dependencies pinned appropriately?
   - Is minimumReleaseAge configured?
   - Is trustPolicy enabled?
4. Run pnpm audit analysis

DELIVERABLE:
- Security configuration assessment
- Vulnerability exposure analysis
- Recommended security improvements
```

#### Prompt 5.2: Dependency Currency Analysis

```
You are analyzing dependency currency and update strategy.

CONTEXT:
- AWS SDK v3 at 3.958.0 (multiple clients)
- TypeScript 5.9.3
- Vitest 4.0.16
- Drizzle ORM 0.45.1

TASK:
1. Check current versions against latest releases
2. Identify dependencies significantly behind latest
3. Evaluate update risk for each outdated dependency
4. Review Dependabot configuration

DELIVERABLE:
- Dependency currency matrix
- Update risk assessment
- Prioritized update plan
```

#### Prompt 5.3: Dependency Weight Analysis

```
You are analyzing dependency weight and bundle impact.

CONTEXT:
- esbuild bundles Lambda functions
- AWS SDK v3 modular imports for tree-shaking
- webpack externals configured for AWS SDK

TASK:
1. Read config/esbuild.config.ts
2. Analyze bundle sizes in build/
3. Identify heavy dependencies
4. Evaluate tree-shaking effectiveness

DELIVERABLE:
- Bundle size breakdown
- Heavy dependency analysis
- Optimization recommendations
```

#### Prompt 5.4: Dev Dependency Necessity Audit

```
You are auditing dev dependency necessity.

CONTEXT:
- 47 dev dependencies
- Multiple tools with overlapping functionality
- AI tools: lancedb, fastembed, repomix

TASK:
1. Categorize all dev dependencies by purpose
2. Identify potentially redundant dependencies
3. Evaluate if all dependencies are actively used
4. Check for deprecated packages

DELIVERABLE:
- Dependency categorization
- Redundancy analysis
- Removal recommendations
```

#### Prompt 5.5: Monorepo Readiness Assessment

```
You are assessing monorepo readiness of dependencies.

CONTEXT:
- Single package.json for entire project
- Lambda functions share all dependencies
- build/graph.json tracks actual imports

TASK:
1. Analyze build/graph.json for actual dependency usage per Lambda
2. Identify shared vs. Lambda-specific dependencies
3. Evaluate workspace/monorepo migration potential
4. Calculate per-Lambda dependency requirements

DELIVERABLE:
- Dependency usage map per Lambda
- Monorepo migration assessment
- Workspace structure recommendation
```

---

## 6. AI Agent Helpers (MCP, Claude Commands)

### Current State Summary

**MCP Server (src/mcp/):**
- 20+ query and validation tools
- AST-based convention enforcement (18 rules)
- Semantic search via LanceDB
- GraphRAG integration

**Claude Commands (.claude/commands/):**
- 12 command files
- create-lambda, implement, validate, review, describe-pr
- Workflow automation with human checkpoints

**Skills:**
- Defined via SKILL.md files
- Auto-triggered by Claude based on context

### Web Research Context

**2025 Best Practices:**
- [MCP November 2025 spec](https://modelcontextprotocol.io/specification/2025-11-25) - OAuth, elicitation, structured outputs
- [Claude Code skills](https://mikhail.io/2025/10/claude-code-skills/) - on-demand prompt expansion
- [Skills vs Commands](https://www.youngleaders.tech/p/claude-skills-commands-subagents-plugins) - when to use each

---

### Claude Evaluation Prompts

#### Prompt 6.1: MCP Server Capabilities Audit

```
You are auditing MCP server capabilities and coverage.

CONTEXT:
- src/mcp/server.ts is the entry point
- 20+ tools across categories: query, validation, refactoring, analysis
- 18 AST-based validation rules
- Semantic search via LanceDB

TASK:
1. Read src/mcp/server.ts
2. Read src/mcp/handlers/ for all tool implementations
3. Read src/mcp/validation/ for rule implementations
4. Evaluate against MCP November 2025 spec:
   - Are tools properly documented?
   - Is error handling robust?
   - Are security best practices followed?
5. Test 5 tools with the MCP inspector

DELIVERABLE:
- Tool capability matrix
- Spec compliance assessment
- Missing tool recommendations
```

#### Prompt 6.2: Claude Command Workflow Analysis

```
You are analyzing Claude command workflows.

CONTEXT:
- 12 commands in .claude/commands/
- Commands use MCP tools for queries
- Human checkpoints at key decision points

TASK:
1. Read all .claude/commands/*.md files
2. Analyze workflow completeness
3. Evaluate human checkpoint placement
4. Check for missing use cases

DELIVERABLE:
- Command coverage analysis
- Workflow quality assessment
- Missing command recommendations
```

#### Prompt 6.3: Convention Validation Rule Effectiveness

```
You are evaluating convention validation rule effectiveness.

CONTEXT:
- 18 MCP validation rules (5 CRITICAL, 9 HIGH, 4 MEDIUM)
- Rules use ts-morph for AST analysis
- src/mcp/validation/ contains rule implementations

TASK:
1. Read src/mcp/validation/ rule files
2. For each CRITICAL rule, verify it catches all violations
3. Test rules against intentionally violating code
4. Evaluate false positive/negative rates

DELIVERABLE:
- Rule effectiveness assessment
- False positive/negative analysis
- Rule improvement recommendations
```

#### Prompt 6.4: Semantic Search Quality

```
You are evaluating semantic search quality.

CONTEXT:
- LanceDB vector database for semantic search
- pnpm run index:codebase indexes the codebase
- pnpm run search:codebase performs queries
- fastembed for embeddings

TASK:
1. Read scripts/indexCodebase.ts
2. Read scripts/searchCodebase.ts
3. Run 10 semantic search queries and evaluate results:
   - "error handling patterns"
   - "authentication flow"
   - "S3 upload logic"
   - "device registration"
   - "cascade deletion"
4. Evaluate relevance and ranking quality

DELIVERABLE:
- Search quality assessment
- Query type effectiveness analysis
- Embedding/indexing improvements
```

#### Prompt 6.5: GraphRAG Knowledge Graph Analysis

```
You are analyzing the GraphRAG knowledge graph.

CONTEXT:
- graphrag/metadata.json contains semantic metadata
- graphrag/extract.ts generates knowledge-graph.json
- Supports multi-hop queries for Lambda chains

TASK:
1. Read graphrag/metadata.json
2. Read graphrag/extract.ts
3. Analyze knowledge-graph.json structure
4. Test multi-hop queries:
   - "What happens when a file is uploaded to S3?"
   - "Which Lambdas access the Users entity?"
5. Evaluate graph completeness

DELIVERABLE:
- Knowledge graph coverage assessment
- Multi-hop query effectiveness
- Missing relationship recommendations
```

---

## 7. Source Code Architecture

### Current State Summary

**Structure:**
- src/lambdas/ - 17 Lambda functions
- src/entities/ - Drizzle ORM queries (Aurora DSQL)
- src/lib/vendor/ - AWS SDK wrappers, Better Auth, Drizzle config
- src/types/ - TypeScript type definitions
- src/util/ - Shared utilities

**Patterns:**
- Vendor encapsulation (zero AWS SDK imports in business logic)
- Powertools for logging, metrics, tracing
- Response helpers for consistent API responses
- Factory functions for entity access

### Web Research Context

**2025 Best Practices:**
- [Lambda Node.js 22](https://aws.amazon.com/blogs/compute/node-js-22-runtime-now-available-in-aws-lambda/) - ESM, require() for ESM
- [Node.js 24 callback deprecation](https://aws.amazon.com/blogs/compute/node-js-24-runtime-now-available-in-aws-lambda/) - async handlers only
- [Drizzle ORM 2025 best practices](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)
- [Aurora DSQL + Drizzle](https://dev.to/stevendsanders/exploring-aurora-dsql-with-typescript-drizzle-lambda-and-aws-cdk-24f2)

---

### Claude Evaluation Prompts

#### Prompt 7.1: Lambda Handler Pattern Consistency

```
You are evaluating Lambda handler pattern consistency.

CONTEXT:
- 17 Lambda handlers in src/lambdas/*/src/index.ts
- Documented patterns in docs/wiki/TypeScript/Lambda-Function-Patterns.md
- Powertools integration required
- Response helper usage enforced

TASK:
1. Read docs/wiki/TypeScript/Lambda-Function-Patterns.md
2. Read 8 different Lambda handlers
3. Evaluate against documented patterns:
   - Consistent error handling
   - Powertools usage
   - Response helper usage
   - TSDoc documentation
4. Identify pattern drift

DELIVERABLE:
- Pattern adherence matrix
- Drift instances with file:line
- Standardization recommendations
```

#### Prompt 7.2: Vendor Encapsulation Compliance

```
You are verifying vendor encapsulation compliance.

CONTEXT:
- CRITICAL convention: No direct AWS SDK imports in business logic
- src/lib/vendor/AWS/ contains all SDK wrappers
- ESLint + MCP rules enforce this
- Dependency cruiser validates boundaries

TASK:
1. Read src/lib/vendor/AWS/ wrapper implementations
2. Grep for any direct @aws-sdk imports outside vendor/
3. Verify dependency cruiser configuration
4. Check for encapsulation bypass attempts

DELIVERABLE:
- Compliance verification report
- Any violations found
- Encapsulation improvement suggestions
```

#### Prompt 7.3: Entity Layer Architecture

```
You are evaluating the entity layer architecture.

CONTEXT:
- src/entities/ contains Drizzle ORM query modules
- src/lib/vendor/Drizzle/ contains schema and connection
- Aurora DSQL with IAM authentication
- No foreign keys (application-enforced relationships)

TASK:
1. Read src/lib/vendor/Drizzle/schema.ts
2. Read src/entities/queries/*.ts
3. Evaluate:
   - Query function organization
   - Transaction handling
   - Error handling patterns
   - Relationship enforcement
4. Compare against Drizzle 2025 best practices

DELIVERABLE:
- Entity architecture assessment
- Query pattern analysis
- Improvement recommendations
```

#### Prompt 7.4: Utility Function Analysis

```
You are analyzing shared utility functions.

CONTEXT:
- src/util/ contains shared utilities
- response.ts, env.ts, and others
- Used across all Lambda handlers

TASK:
1. Read all files in src/util/
2. Evaluate:
   - Function cohesion
   - Type safety
   - Error handling
   - Documentation
3. Check for utility code in Lambda handlers that should be extracted

DELIVERABLE:
- Utility catalog
- Code quality assessment
- Extraction recommendations
```

#### Prompt 7.5: Type Definition Organization

```
You are evaluating type definition organization.

CONTEXT:
- src/types/ contains all type definitions
- Types organized by purpose: domain-models.d.ts, request-types.d.ts, etc.
- Naming conventions documented in docs/wiki/Conventions/Naming-Conventions.md

TASK:
1. Read docs/wiki/Conventions/Naming-Conventions.md
2. Read all files in src/types/
3. Verify naming convention adherence
4. Check for type duplication or inconsistency

DELIVERABLE:
- Type organization assessment
- Naming convention compliance
- Type improvement recommendations
```

---

## 8. Security & Supply Chain

### Current State Summary

**Configurations:**
- pnpm lifecycle script protection (.npmrc)
- SOPS for secrets encryption
- GitHub Dependabot for updates
- Security audit in CI

**Sensitive Data:**
- secrets.enc.yaml (SOPS encrypted)
- APNS certificates
- YouTube cookies
- Better Auth secrets

### Web Research Context

**2025 Best Practices:**
- [2025 npm supply chain attack](https://www.propelcode.ai/blog/npm-supply-chain-attack-analysis-2025) - preinstall script exploitation
- [pnpm trustPolicy](https://pnpm.io/supply-chain-security) - downgrade prevention
- [minimumReleaseAge](https://pnpm.io/blog/2025/12/05/newsroom-npm-supply-chain-security) - delay new package installation

---

### Claude Evaluation Prompts

#### Prompt 8.1: Supply Chain Security Audit

```
You are auditing supply chain security.

CONTEXT:
- pnpm 10.0.0 with lifecycle scripts disabled
- .npmrc onlyBuiltDependencies allowlist
- 75 dependencies total
- November 2025 Shai-Hulud attack affected npm ecosystem

TASK:
1. Read .npmrc configuration
2. Evaluate against 2025 supply chain best practices:
   - minimumReleaseAge setting
   - trustPolicy configuration
   - blockExoticSubdeps setting
   - strictDepBuilds enforcement
3. Check for typosquatting risks in dependencies
4. Verify lockfile integrity

DELIVERABLE:
- Supply chain security assessment
- Configuration gap analysis
- Recommended hardening measures
```

#### Prompt 8.2: Secrets Management Audit

```
You are auditing secrets management.

CONTEXT:
- SOPS encryption for secrets.enc.yaml
- Environment variables for Lambda secrets
- APNS certificates (p12 format)
- YouTube cookies for yt-dlp

TASK:
1. Search for any hardcoded secrets in codebase
2. Verify SOPS configuration
3. Check environment variable handling in Terraform
4. Evaluate secret rotation capabilities

DELIVERABLE:
- Secrets exposure assessment
- SOPS configuration review
- Secret management improvements
```

#### Prompt 8.3: Authentication Security Review

```
You are reviewing authentication security.

CONTEXT:
- Better Auth for user authentication
- Sign In With Apple integration
- API Gateway custom authorizer
- JWT token handling

TASK:
1. Read src/lambdas/ApiGatewayAuthorizer/src/index.ts
2. Read src/lambdas/LoginUser/src/index.ts
3. Read src/lib/vendor/BetterAuth/ configuration
4. Evaluate:
   - Token validation
   - Session management
   - Rate limiting
   - CORS configuration

DELIVERABLE:
- Authentication security assessment
- Vulnerability analysis
- Security hardening recommendations
```

#### Prompt 8.4: IAM Permission Review

```
You are reviewing IAM permissions.

CONTEXT:
- Each Lambda has dedicated IAM role
- Common policies attached to all Lambdas
- Aurora DSQL IAM authentication
- S3 bucket policies

TASK:
1. Read all IAM policies in terraform/
2. Identify overly permissive policies
3. Check for unused permissions
4. Verify least-privilege adherence

DELIVERABLE:
- IAM permission audit
- Overly permissive policy list
- Least-privilege recommendations
```

#### Prompt 8.5: Dependency Vulnerability Scan

```
You are performing a dependency vulnerability scan.

CONTEXT:
- pnpm audit for vulnerability scanning
- GitHub Dependabot for automated updates
- CI runs security audit

TASK:
1. Run pnpm audit --audit-level=high
2. Analyze Dependabot configuration
3. Check for dependencies with known vulnerabilities
4. Evaluate remediation strategy

DELIVERABLE:
- Vulnerability scan results
- Dependabot configuration assessment
- Remediation priority list
```

---

## 9. Build & Bundling

### Current State Summary

**Stack:**
- esbuild for Lambda bundling
- ESM output format
- AWS SDK v3 modular imports for tree-shaking
- Bundle analysis with esbuild-visualizer

**Optimizations:**
- minify: true
- treeShaking: true
- Externals for AWS SDK in some cases

### Web Research Context

**2025 Best Practices:**
- [esbuild Lambda optimization](https://cajuncodemonkey.com/posts/bundles-for-aws-lambda-with-esbuild/)
- [ESM vs CommonJS](https://medium.com/levi-niners-crafts/node-js-lambda-package-optimization-decrease-size-and-increase-performance-using-es-modules-100b392b7732) - 62% smaller bundles
- [Cold start optimization](https://aws.amazon.com/blogs/compute/optimizing-node-js-dependencies-in-aws-lambda/) - 70% improvement possible

---

### Claude Evaluation Prompts

#### Prompt 9.1: Bundle Size Analysis

```
You are analyzing Lambda bundle sizes.

CONTEXT:
- esbuild bundles in build/lambdas/
- ESM format with tree-shaking
- AWS SDK v3 modular imports

TASK:
1. Read config/esbuild.config.ts
2. Analyze bundle sizes in build/lambdas/
3. Use esbuild visualizer for breakdown
4. Identify heavy dependencies per bundle

DELIVERABLE:
- Bundle size report
- Heavy dependency analysis
- Size reduction recommendations
```

#### Prompt 9.2: Cold Start Optimization

```
You are evaluating cold start optimization.

CONTEXT:
- Lambda memory: 256MB default
- Bundle sizes affect cold start
- AWS SDK v3 bundled (not external)
- OpenTelemetry layer included

TASK:
1. Analyze bundle sizes vs. cold start estimates
2. Evaluate memory configuration appropriateness
3. Check for lazy loading opportunities
4. Compare bundled vs. external SDK approach

DELIVERABLE:
- Cold start impact assessment
- Memory optimization recommendations
- Lazy loading opportunities
```

#### Prompt 9.3: Build Configuration Review

```
You are reviewing build configuration.

CONTEXT:
- config/esbuild.config.ts is the build config
- Automatic Lambda discovery from src/lambdas/
- Source maps enabled
- Module aliases configured

TASK:
1. Read config/esbuild.config.ts thoroughly
2. Evaluate configuration options:
   - Minification settings
   - Tree-shaking effectiveness
   - External dependencies
   - Target configuration
3. Compare against 2025 esbuild best practices

DELIVERABLE:
- Configuration assessment
- Optimization opportunities
- Recommended configuration changes
```

#### Prompt 9.4: Lambda Layer Analysis

```
You are analyzing Lambda layer usage.

CONTEXT:
- ADOT layer for OpenTelemetry
- yt-dlp binary layer (StartFileUpload)
- ffmpeg binary layer (StartFileUpload)
- No shared code layer

TASK:
1. Read terraform/ for layer configurations
2. Analyze layer size impact
3. Evaluate shared code layer opportunity
4. Check binary layer update mechanism

DELIVERABLE:
- Layer usage analysis
- Shared layer recommendations
- Binary update improvements
```

#### Prompt 9.5: ESM Migration Assessment

```
You are assessing ESM migration completeness.

CONTEXT:
- package.json: "type": "module"
- esbuild output format: esm
- Module aliases via imports map

TASK:
1. Check for any CommonJS remnants
2. Verify all imports use ESM syntax
3. Check for dynamic imports compatibility
4. Evaluate tree-shaking effectiveness

DELIVERABLE:
- ESM migration completeness
- CommonJS remnant list
- Tree-shaking effectiveness report
```

---

## 10. Observability & Monitoring

### Current State Summary

**Stack:**
- AWS Lambda Powertools (logger, metrics, tracer)
- AWS X-Ray distributed tracing
- CloudWatch logs, metrics, dashboards
- OpenTelemetry (ADOT layer)

**Configuration:**
- Dashboard: MediaDownloader (invocations, errors, duration)
- Log retention: 7 days
- X-Ray tracing: Active on all Lambdas
- Metrics: Custom business metrics via Powertools

### Web Research Context

**2025 Best Practices:**
- [Powertools for AWS Lambda TypeScript](https://aws.amazon.com/blogs/compute/simplifying-serverless-best-practices-with-aws-lambda-powertools-for-typescript/)
- [Three usage patterns](https://docs.powertools.aws.dev/lambda/typescript/latest/getting-started/usage-patterns/) - decorators, middy, functional
- Structured logging with CloudWatch Logs Insights

---

### Claude Evaluation Prompts

#### Prompt 10.1: Logging Strategy Assessment

```
You are assessing the logging strategy.

CONTEXT:
- Powertools Logger for structured logging
- LOG_LEVEL configurable per Lambda
- CloudWatch Logs with 7-day retention

TASK:
1. Read src/lib/vendor/AWS/Powertools.ts
2. Read 5 Lambda handlers for logging usage
3. Evaluate:
   - Log level consistency
   - Structured data inclusion
   - Sensitive data handling
   - Correlation ID propagation

DELIVERABLE:
- Logging strategy assessment
- Consistency analysis
- Improvement recommendations
```

#### Prompt 10.2: Metrics Coverage Analysis

```
You are analyzing custom metrics coverage.

CONTEXT:
- Powertools Metrics for custom metrics
- Business metrics defined per Lambda
- CloudWatch dashboard visualization

TASK:
1. Read terraform/cloudwatch.tf dashboard config
2. Read 5 Lambda handlers for metrics usage
3. Identify:
   - Business metrics being tracked
   - Missing important metrics
   - Metric namespace consistency

DELIVERABLE:
- Metrics coverage report
- Missing metrics recommendations
- Dashboard improvement suggestions
```

#### Prompt 10.3: Distributed Tracing Evaluation

```
You are evaluating distributed tracing implementation.

CONTEXT:
- AWS X-Ray with Active tracing
- Powertools Tracer for instrumentation
- ADOT layer for OpenTelemetry export

TASK:
1. Read terraform/ for X-Ray configuration
2. Read Lambda handlers for tracer usage
3. Verify trace propagation across services:
   - API Gateway → Lambda
   - Lambda → SQS → Lambda
   - Lambda → S3

DELIVERABLE:
- Tracing coverage assessment
- Propagation verification
- Instrumentation improvements
```

#### Prompt 10.4: Alerting Configuration Review

```
You are reviewing alerting configuration.

CONTEXT:
- CloudWatch alarms likely configured
- Dashboard shows error threshold annotations
- No PagerDuty/OpsGenie integration visible

TASK:
1. Read terraform/cloudwatch.tf for alarms
2. Evaluate alarm thresholds
3. Check for missing critical alerts:
   - Lambda errors
   - DLQ messages
   - API Gateway 5xx
   - S3 failures

DELIVERABLE:
- Alerting coverage assessment
- Missing alarm recommendations
- Threshold appropriateness analysis
```

#### Prompt 10.5: Error Handling and Debugging

```
You are evaluating error handling and debugging capabilities.

CONTEXT:
- GitHub issue creation for errors
- Structured error logging
- X-Ray for trace analysis

TASK:
1. Read src/util/ for error handling utilities
2. Read Lambda handlers for error patterns
3. Evaluate:
   - Error classification
   - Stack trace handling
   - Error context enrichment
   - Debugging workflow

DELIVERABLE:
- Error handling assessment
- Debugging capability analysis
- Improvement recommendations
```

---

## Appendix: Web Research Sources

### Testing
- [aws-sdk-client-mock](https://github.com/m-radzikowski/aws-sdk-client-mock)
- [Stryker Mutator](https://stryker-mutator.io/)
- [LocalStack VS Code Integration](https://aws.amazon.com/blogs/aws/accelerate-serverless-testing-with-localstack-integration-in-vs-code-ide/)

### Infrastructure
- [OpenTofu Best Practices](https://terramate.io/rethinking-iac/terraform-and-opentofu-best-practices/)
- [Aurora DSQL Introduction](https://blog.awsfundamentals.com/aurora-dsql-introduction)

### AI/MCP
- [MCP November 2025 Spec](https://modelcontextprotocol.io/specification/2025-11-25)
- [Claude Code Skills](https://mikhail.io/2025/10/claude-code-skills/)
- [Repomix](https://repomix.com/)

### Security
- [pnpm Supply Chain Security](https://pnpm.io/supply-chain-security)
- [npm Security Best Practices 2025](https://snyk.io/articles/npm-security-best-practices-shai-hulud-attack/)

### Performance
- [esbuild Lambda Optimization](https://cajuncodemonkey.com/posts/bundles-for-aws-lambda-with-esbuild/)
- [Lambda Powertools TypeScript](https://docs.powertools.aws.dev/lambda/typescript/latest/)

---

## Execution Guidance

### Recommended Order
1. Start with **Section 1 (Testing)** - foundation for confidence
2. Then **Section 7 (Source Architecture)** - understand the codebase
3. Then **Section 8 (Security)** - identify critical issues
4. Remaining sections in parallel

### Per-Prompt Instructions
1. Create a new Claude session for each prompt
2. Include the full prompt text
3. Allow the Claude instance to read all referenced files
4. Capture structured findings in markdown
5. Aggregate findings into a master report

### Output Format
Each Claude instance should produce:
```markdown
## [Section Name] - [Prompt Number]

### Findings
- Finding 1 (file:line)
- Finding 2 (file:line)

### Recommendations
1. Recommendation (Priority: HIGH/MEDIUM/LOW)
2. Recommendation (Priority: HIGH/MEDIUM/LOW)

### Sources Consulted
- file1.ts
- file2.md
```
