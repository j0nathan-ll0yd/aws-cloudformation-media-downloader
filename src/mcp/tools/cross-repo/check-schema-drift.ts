import type {ToolDefinition} from '../types.js'
import {handleSchemaDriftQuery} from '../../handlers/cross-repo/schema-drift.js'
import type {SchemaDriftArgs} from '../../handlers/cross-repo/schema-drift.js'

export const checkSchemaDriftTool: ToolDefinition = {
  name: 'check_schema_drift',
  description: `Detect discrepancies between Drizzle ORM schema and SQL migrations.

Examples:
- Check all: {query: "check"}
- List tables: {query: "tables"}
- Check columns: {query: "columns", table: "users"}
- Check indexes: {query: "indexes", table: "users"}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type: check (detect drift), tables (list tables), columns (compare columns), indexes (compare indexes)',
        enum: ['check', 'tables', 'columns', 'indexes']
      },
      table: {type: 'string', description: 'Specific table name to analyze (optional)'}
    },
    required: ['query']
  },
  handler: (args) => handleSchemaDriftQuery(args as unknown as SchemaDriftArgs)
}
