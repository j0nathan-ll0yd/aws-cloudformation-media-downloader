import type {ToolDefinition} from '../types.js'
import {handleValidationQuery} from '../../handlers/validation.js'
import type {ValidationQueryArgs} from '../../handlers/validation.js'

export const validatePatternTool: ToolDefinition = {
  name: 'validate_pattern',
  description: `Validate code against project conventions using AST analysis (22 rules: 7 CRITICAL, 11 HIGH, 4 MEDIUM).

Examples:
- List rules: {query: "rules"}
- Validate file: {file: "src/lambdas/ListFiles/src/index.ts", query: "all"}
- Check AWS SDK: {file: "src/lambdas/ListFiles/src/index.ts", query: "aws-sdk"}
- Summary: {query: "summary"}`,
  inputSchema: {
    type: 'object',
    properties: {
      file: {type: 'string', description: 'File path to validate (relative to project root). If omitted, validates based on query type.'},
      query: {
        type: 'string',
        description:
          'Validation type: all (run all rules), aws-sdk (vendor encapsulation), entity (entity mocking), imports (order), response (helpers), rules (list available), summary (violation counts)',
        enum: ['all', 'aws-sdk', 'entity', 'imports', 'response', 'rules', 'summary']
      }
    },
    required: ['query']
  },
  handler: (args) => handleValidationQuery(args as unknown as ValidationQueryArgs)
}
