import type {ToolDefinition} from '../types.js'
import {handleTestScaffoldQuery} from '../../handlers/test-scaffold.js'
import type {TestScaffoldQueryArgs} from '../../handlers/test-scaffold.js'

export const suggestTestsTool: ToolDefinition = {
  name: 'suggest_tests',
  description: `Generate test file scaffolding with all required mocks.

Examples:
- Full scaffold: {file: "src/lambdas/ListFiles/src/index.ts", query: "scaffold"}
- Mock setup: {file: "src/lambdas/ListFiles/src/index.ts", query: "mocks"}
- Test fixtures: {file: "src/lambdas/ListFiles/src/index.ts", query: "fixtures"}
- Structure only: {file: "src/lambdas/ListFiles/src/index.ts", query: "structure"}`,
  inputSchema: {
    type: 'object',
    properties: {
      file: {type: 'string', description: 'Source file to generate tests for'},
      query: {type: 'string', description: 'Query type (scaffold, mocks, fixtures, structure)', enum: ['scaffold', 'mocks', 'fixtures', 'structure']}
    },
    required: ['file', 'query']
  },
  handler: (args) => handleTestScaffoldQuery(args as unknown as TestScaffoldQueryArgs)
}
