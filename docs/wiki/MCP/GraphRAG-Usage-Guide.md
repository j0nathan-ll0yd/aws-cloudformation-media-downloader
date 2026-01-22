# GraphRAG Usage Guide

This guide covers the GraphRAG and semantic search capabilities for navigating the codebase.

## Overview

The project has two complementary search systems:

| System | Purpose | Technology |
|--------|---------|------------|
| **Knowledge Graph** | Multi-hop reasoning about Lambda chains, entities, services | JSON graph with BFS/DFS traversal |
| **Semantic Search** | Natural language code search | LanceDB vector database + embeddings |

## Quick Start

### Index the Codebase

Before using semantic search, index the codebase:

```bash
pnpm run index:codebase
```

This creates a vector database in `.lancedb/` with embeddings for all code chunks.

### Search with Natural Language

```bash
pnpm run search:codebase "how does authentication work"
pnpm run search:codebase "where are push notifications sent"
pnpm run search:codebase "database connection setup"
```

### Query the Knowledge Graph

```bash
pnpm run graphrag:query
```

This runs example queries showing:
- File deletion impact analysis
- Upload flow tracing
- Circular dependency detection
- Impact analysis for changes

## Knowledge Graph Architecture

### File Structure

```
graphrag/
├── metadata.json         # Semantic metadata (triggers, purposes)
├── metadata.schema.json  # JSON Schema for metadata
├── extract.ts            # Graph extraction script
├── query.ts              # Query interface
└── knowledge-graph.json  # Generated graph (gitignored)
```

### Node Types

| Type | Example ID | Description |
|------|-----------|-------------|
| `Lambda` | `lambda:StartFileUpload` | Lambda function |
| `Entity` | `entity:Files` | Drizzle ORM entity |
| `Service` | `service:S3` | AWS service |
| `External` | `external:YouTube` | External API |
| `ApiEndpoint` | `api:POST:/files` | API Gateway endpoint |

### Edge Types

| Relationship | Example |
|-------------|---------|
| `accesses` | Lambda accesses Entity |
| `invokes` | Lambda invokes Service |
| `triggers` | S3 Event triggers Lambda |
| `publishes_to` | Lambda publishes to EventBridge |

## MCP Integration

The MCP server exposes GraphRAG tools via Model Context Protocol.

### search_codebase_semantics

Query the vector database with natural language:

```
Tool: search_codebase_semantics
Input: {
  "query": "error handling patterns",
  "limit": 10
}
```

### index_codebase

Re-index after significant changes:

```
Tool: index_codebase
```

### lambda_impact

Analyze what's affected by changing a Lambda:

```
Tool: lambda_impact
Input: {
  "file": "src/lambdas/ListFiles/src/index.ts",
  "query": "all"
}
```

## Keeping GraphRAG in Sync

### When to Re-index Semantic Search

Run `pnpm run index:codebase` after:
- Adding/removing Lambda functions
- Major refactoring
- Adding new utility modules
- Changing entity definitions

### When to Regenerate Knowledge Graph

Run `pnpm run graphrag:extract` after:
- Adding/removing Lambda functions
- Changing Lambda triggers
- Adding new entity relationships
- Adding new AWS service integrations

### Metadata Updates

Update `graphrag/metadata.json` when:
- Adding new Lambda functions (add trigger and purpose)
- Adding new service integrations
- Changing invocation chains

### CI Validation

The `auto-update-graphrag.yml` workflow validates synchronization:
- Runs on every push
- Fails if `knowledge-graph.json` is outdated
- Reminder to run `pnpm run graphrag:extract`

## Example Queries

### Semantic Search Examples

| Query | What It Finds |
|-------|---------------|
| `"user authentication flow"` | Auth middleware, Better Auth, sessions |
| `"download video from youtube"` | StartFileUpload, yt-dlp wrapper |
| `"send push notification"` | APNS, SNS, SendPushNotification Lambda |
| `"database entity relationships"` | Drizzle schema, entity files |
| `"error handling"` | Error classes, try-catch patterns |
| `"S3 upload"` | S3 vendor wrapper, presigned URLs |

### Knowledge Graph Examples

```typescript
// Find paths between Lambdas
const paths = query.findPaths('lambda:WebhookFeedly', 'lambda:SendPushNotification')
// Result: WebhookFeedly → EventBridge → StartFileUpload → S3 → S3ObjectCreated → SendPushNotification

// Impact analysis
const impact = query.findImpact('entity:Users', 2)
// Result: All Lambdas and services affected by Users entity changes

// Dependency analysis
const deps = query.findDependencies('lambda:UserDelete')
// Result: Users, UserFiles, UserDevices, S3, SNS
```

## Troubleshooting

### "No results found"

1. Ensure the index is up to date: `pnpm run index:codebase`
2. Try broader query terms
3. Check if LanceDB is installed: `pnpm install`

### "Stale results"

1. Knowledge graph may be outdated
2. Run `pnpm run graphrag:extract` to regenerate
3. Run `pnpm run validate:graphrag` to check sync status

### "LanceDB not available"

1. LanceDB requires native binaries
2. Run `pnpm install` to install
3. On ARM Mac, ensure Rosetta 2 is installed if needed

### "Embeddings generation slow"

- First run downloads the embedding model (~100 MB)
- Subsequent runs use cached model
- Indexing large codebases takes 1-2 minutes

## Best Practices

1. **Run indexing before major refactoring sessions**
2. **Update metadata.json when adding Lambdas**
3. **Use semantic search for exploratory questions**
4. **Use knowledge graph for impact analysis**
5. **Commit knowledge-graph.json if it changes**
