import type {ToolDefinition} from '../types.js'
import {handleInlineConstantQuery} from '../../handlers/refactoring/inline-constant.js'
import type {InlineConstantArgs} from '../../handlers/refactoring/inline-constant.js'

export const inlineConstantTool: ToolDefinition = {
  name: 'refactor_inline_constant',
  description: `Find and inline single-use exported constants.

Examples:
- Find candidates: {query: "find"}
- In specific file: {query: "find", file: "src/constants.ts", maxUses: 2}
- Preview inline: {query: "preview", constant: "DEFAULT_TIMEOUT"}
- Execute: {query: "execute", constant: "DEFAULT_TIMEOUT"}`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query type: find (discover low-use constants), preview (show inlining plan), execute (guidance for manual inlining)',
        enum: ['find', 'preview', 'execute']
      },
      file: {type: 'string', description: 'File to analyze for constants'},
      constant: {type: 'string', description: 'Specific constant name to inline'},
      maxUses: {type: 'number', description: 'Maximum usage count to consider for inlining (default: 3)'}
    },
    required: ['query']
  },
  handler: (args) => handleInlineConstantQuery(args as unknown as InlineConstantArgs)
}
