import {defineTool} from '../types.js'
import {handleTestScaffoldQuery} from '../../handlers/test-scaffold.js'
import type {TestScaffoldQueryArgs} from '../../handlers/test-scaffold.js'

export const suggestTestsTool = defineTool({
  name: 'suggest_tests',
  description: `Generate test file scaffolding with all required mocks.

Examples:
- Generate scaffold: {"file": "src/lambdas/NewLambda/src/index.ts", "query": "scaffold"}
- Get mock templates: {"file": "src/lambdas/NewLambda/src/index.ts", "query": "mocks"}`,
  inputSchema: {
    type: 'object',
    properties: {
      file: {type: 'string', description: 'Source file to generate tests for'},
      query: {type: 'string', description: 'Query type (scaffold, mocks, fixtures, structure)', enum: ['scaffold', 'mocks', 'fixtures', 'structure']}
    },
    required: ['file', 'query']
  },
  handler: (args) => handleTestScaffoldQuery(args as unknown as TestScaffoldQueryArgs)
})
