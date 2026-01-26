# Glossary

Project-specific terminology and acronyms used throughout the Media Downloader documentation.

## Architecture & Standards

| Term | Definition |
|------|------------|
| **ADR** | Architecture Decision Record. A document capturing a significant architectural decision, its context, and consequences. Uses [MADR 4.0](https://adr.github.io/madr/) format. |
| **arc42** | A template for documenting software architectures with 12 standardized sections. Evaluated but not adopted for this project. |
| **C4 Model** | A hierarchical approach to software architecture diagrams: Context, Container, Component, Code. Used for diagram organization in [System-Diagrams.md](../Architecture/System-Diagrams.md). |
| **MADR** | Markdown Any Decision Record. The lightweight ADR format used in this project, stored in `docs/wiki/Decisions/`. |

## AWS & Infrastructure

| Term | Definition |
|------|------------|
| **Aurora DSQL** | Amazon Aurora Distributed SQL. A serverless, PostgreSQL-compatible database with automatic scaling and no VPC required. The project's primary data store. |
| **CloudFront** | AWS content delivery network (CDN) service used for edge caching and media distribution. |
| **EventBridge** | AWS serverless event bus for routing events between Lambda functions and other AWS services. |
| **Lambda@Edge** | AWS Lambda functions that run at CloudFront edge locations for request/response processing. |
| **LocalStack** | A local AWS cloud emulator used for integration testing without incurring AWS costs. |
| **OpenTofu** | Open-source Infrastructure as Code tool (Terraform fork) used for defining AWS infrastructure. |
| **Powertools** | AWS Lambda Powertools for TypeScript. Provides logging, tracing, and metrics utilities. |
| **S3 Transfer Acceleration** | AWS S3 feature that speeds up uploads/downloads using CloudFront edge locations. |

## Database & Entities

| Term | Definition |
|------|------------|
| **Drizzle ORM** | TypeScript ORM providing type-safe database queries. Used with Aurora DSQL. |
| **Entity Queries** | Functions in `src/entities/queries/` that encapsulate database operations via Drizzle ORM. |
| **Prepared Statements** | Pre-compiled SQL statements in `preparedQueries.ts` for performance-critical operations. |
| **Row Types** | TypeScript types suffixed with `Row` (for example, `UserRow`) representing database table rows. |

## Development Patterns

| Term | Definition |
|------|------------|
| **Convention Capture** | The system for detecting, documenting, and enforcing emergent coding patterns. See [Convention-Capture-System.md](Convention-Capture-System.md). |
| **MCP** | Model Context Protocol. A standardized interface for AI tools to interact with codebases. The project's MCP server provides convention validation tools. |
| **Passthrough File** | A file that references another canonical file (for example, `CLAUDE.md` → `AGENTS.md`), enabling multiple tools to use the same content. |
| **Remocal Testing** | Testing pattern combining local and remote environments. Uses LocalStack locally while still being able to test against real AWS services. |
| **Vendor Encapsulation** | The pattern of wrapping third-party SDKs (especially AWS SDK) behind internal interfaces in `src/lib/vendor/`. Zero-tolerance enforcement. |

## External Services

| Term | Definition |
|------|------------|
| **APNS** | Apple Push Notification Service. Used to send notifications to the iOS companion app. |
| **Better Auth** | Authentication library handling sessions, OAuth accounts, and token management. |
| **Feedly** | RSS aggregation service that sends webhook notifications when new articles match saved searches. |
| **Sign In with Apple** | Apple's OAuth provider used for iOS app authentication. |
| **yt-dlp** | Command-line program for downloading videos from YouTube and other sites. Fork of youtube-dl. |

## Testing

| Term | Definition |
|------|------------|
| **Entity Fixtures** | Factory functions in `test/helpers/entity-fixtures.ts` for creating mock database rows. |
| **aws-sdk-client-mock** | Library for mocking AWS SDK v3 clients in unit tests. Helpers in `test/helpers/aws-sdk-mock.ts`. |
| **Vitest** | Modern test framework used for unit and integration testing. Successor to Jest. |

## File Naming Conventions

| Suffix | Usage | Example |
|--------|-------|---------|
| `*Row` | Database row type from Drizzle | `UserRow`, `FileRow` |
| `*Item` | Entity row with joined relations | `UserItem`, `FileItem` |
| `*Input` | Request payload / mutation input | `CreateFileInput` |
| `*Response` | API response wrapper | `FileResponse` |
| `*Error` | Error class | `AuthorizationError` |

---

*For the full project context, see [AGENTS.md](../../../AGENTS.md). For type naming patterns, see [Naming-Conventions.md](../Conventions/Naming-Conventions.md).*
