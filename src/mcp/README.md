# Model Context Protocol (MCP) Server

This MCP server provides queryable interfaces for the Media Downloader codebase, allowing Claude and other AI assistants to understand the project structure without reading files.

## Installation

```bash
# Install dependencies
pnpm install

# Make the server executable
chmod +x src/mcp/server.ts
```

## Configuration

### Claude Code (CLI)

Add this to your project's `.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "media-downloader": {
      "command": "node",
      "args": ["--import", "tsx", "src/mcp/server.ts"]
    }
  }
}
```

### Claude Desktop

Add this to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "media-downloader": {
      "command": "node",
      "args": ["--import", "tsx", "/path/to/project/src/mcp/server.ts"]
    }
  }
}
```

## Available Tools

### 1. query_entities
Query ElectroDB entity schemas and relationships.

```typescript
// Examples:
query_entities({ query: "schema" })                    // Get all schemas
query_entities({ entity: "Users", query: "schema" })   // Get Users schema
query_entities({ query: "relationships" })             // Get all relationships
query_entities({ query: "collections" })               // Get collection queries
```

### 2. query_lambda
Query Lambda function configurations and dependencies.

```typescript
// Examples:
query_lambda({ query: "list" })                        // List all Lambda functions
query_lambda({ lambda: "ListFiles", query: "config" }) // Get ListFiles config
query_lambda({ query: "triggers" })                    // Get all Lambda triggers
query_lambda({ query: "dependencies" })                // Get dependency summary
query_lambda({ lambda: "ListFiles", query: "env" })    // Get env variables
```

### 3. query_infrastructure
Query AWS infrastructure configuration.

```typescript
// Examples:
query_infrastructure({ resource: "dynamodb", query: "config" })     // DynamoDB config
query_infrastructure({ resource: "s3", query: "usage" })            // S3 usage patterns
query_infrastructure({ resource: "all", query: "dependencies" })    // All dependencies
query_infrastructure({ resource: "apigateway", query: "config" })   // API Gateway config
```

### 4. query_dependencies
Query code dependencies from graph.json.

```typescript
// Examples:
query_dependencies({ query: "circular" })              // Find circular dependencies
query_dependencies({
  file: "src/lambdas/ListFiles/src/index.ts",
  query: "imports"
})                                                      // Get file imports
query_dependencies({
  file: "src/entities/Users.ts",
  query: "dependents"
})                                                      // Find who imports this file
query_dependencies({
  file: "src/lambdas/ListFiles/src/index.ts",
  query: "transitive"
})                                                      // Get all transitive dependencies
```

### 5. query_conventions
Search project conventions and wiki documentation.

```typescript
// Examples:
query_conventions({ query: "list" })                    // List all conventions by severity
query_conventions({ query: "search", term: "mock" })    // Search conventions and wiki
query_conventions({ query: "category", category: "testing" }) // Filter by category
query_conventions({ query: "enforcement", severity: "CRITICAL" }) // Get critical rules
query_conventions({ query: "detail", convention: "AWS SDK" }) // Get full convention details
query_conventions({ query: "wiki" })                    // List all wiki pages
```

### 6. validate_pattern
Validate code against project conventions using AST analysis.

```typescript
// Examples:
validate_pattern({ query: "rules" })                    // List all validation rules
validate_pattern({ file: "src/lambdas/ListFiles/src/index.ts", query: "all" }) // Full validation
validate_pattern({ file: "src/lambdas/ListFiles/src/index.ts", query: "aws-sdk" }) // Check SDK encapsulation
validate_pattern({ file: "src/lambdas/ListFiles/test/index.test.ts", query: "electrodb" }) // Check ElectroDB mocking
validate_pattern({ file: "src/lambdas/ListFiles/src/index.ts", query: "summary" }) // Concise summary
```

### 7. check_coverage
Analyze which dependencies need mocking for Jest tests.

```typescript
// Examples:
check_coverage({ file: "src/lambdas/ListFiles/src/index.ts", query: "required" }) // List mocks needed
check_coverage({ file: "src/lambdas/ListFiles/src/index.ts", query: "missing" })  // Compare to existing test
check_coverage({ file: "src/lambdas/ListFiles/src/index.ts", query: "all" })      // Full analysis
check_coverage({ file: "src/lambdas/ListFiles/src/index.ts", query: "summary" })  // Quick summary
```

### 8. lambda_impact
Show what's affected by changing a file.

```typescript
// Examples:
lambda_impact({ file: "src/entities/Files.ts", query: "dependents" })  // Direct dependents
lambda_impact({ file: "src/entities/Files.ts", query: "cascade" })     // Full cascade
lambda_impact({ file: "src/entities/Files.ts", query: "tests" })       // Tests to update
lambda_impact({ file: "src/entities/Files.ts", query: "infrastructure" }) // Terraform files
lambda_impact({ file: "src/util/lambda-helpers.ts", query: "all" })    // Comprehensive analysis
```

### 9. suggest_tests
Generate test file scaffolding with all required mocks.

```typescript
// Examples:
suggest_tests({ file: "src/lambdas/ListFiles/src/index.ts", query: "scaffold" }) // Complete test file
suggest_tests({ file: "src/lambdas/ListFiles/src/index.ts", query: "mocks" })    // Just mock setup
suggest_tests({ file: "src/lambdas/ListFiles/src/index.ts", query: "fixtures" }) // Suggested fixtures
suggest_tests({ file: "src/lambdas/ListFiles/src/index.ts", query: "structure" }) // Test structure outline
```

## Usage Examples

### Understanding Entity Relationships
```
Q: "What entities are in the database?"
Use: query_entities({ query: "schema" })

Q: "How are Users and Files related?"
Use: query_entities({ query: "relationships" })

Q: "How do I query all files for a user?"
Use: query_entities({ query: "collections" })
```

### Lambda Function Analysis
```
Q: "Which Lambda functions use DynamoDB?"
Use: query_lambda({ query: "dependencies" })

Q: "What triggers the FileCoordinator Lambda?"
Use: query_lambda({ lambda: "FileCoordinator", query: "triggers" })

Q: "What environment variables does LoginUser need?"
Use: query_lambda({ lambda: "LoginUser", query: "env" })
```

### Infrastructure Queries
```
Q: "What's the DynamoDB table structure?"
Use: query_infrastructure({ resource: "dynamodb", query: "config" })

Q: "Which Lambdas use S3?"
Use: query_infrastructure({ resource: "s3", query: "usage" })

Q: "What are the API endpoints?"
Use: query_infrastructure({ resource: "apigateway", query: "config" })
```

### Dependency Analysis
```
Q: "What files does ListFiles Lambda depend on?"
Use: query_dependencies({
  file: "src/lambdas/ListFiles/src/index.ts",
  query: "transitive"
})

Q: "Which files import the Users entity?"
Use: query_dependencies({
  file: "src/entities/Users.ts",
  query: "dependents"
})

Q: "Are there any circular dependencies?"
Use: query_dependencies({ query: "circular" })
```

## Development

### Running Locally

```bash
# Run the server directly
node --import tsx src/mcp/server.ts

# Or compile and run
pnpm run build
node dist/mcp/server.js
```

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector src/mcp/server.ts
```

### Extending the Server

To add new query capabilities:

1. Add tool definition in `server.ts` `ListToolsRequestSchema` handler
2. Add case in `CallToolRequestSchema` handler
3. Create handler in `src/mcp/handlers/`
4. Update this README with examples

## Architecture Benefits

- **No File Reading**: AI can understand structure without consuming context on file contents
- **Consistent Responses**: Structured data instead of parsing code
- **Performance**: Fast queries vs. reading multiple files
- **Maintainable**: Single source of truth for architecture information
- **Extensible**: Easy to add new query types as needed

## Integration with Claude

When using Claude with this MCP server, you can ask questions like:

- "Query the MCP server to show me all Lambda functions and their triggers"
- "Use MCP to find which entities have relationships with Users"
- "Query infrastructure to understand the DynamoDB access patterns"
- "Check for circular dependencies in the codebase"

Claude will automatically use the appropriate MCP tool to get structured information about the codebase.