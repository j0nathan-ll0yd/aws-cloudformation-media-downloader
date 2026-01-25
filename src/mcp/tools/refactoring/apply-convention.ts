import type {ToolDefinition} from '../types.js'
import {handleApplyConvention} from '../../handlers/apply-convention.js'
import type {ApplyConventionArgs} from '../../handlers/apply-convention.js'

export const applyConventionTool: ToolDefinition = {
  name: 'apply_convention',
  description: `Automatically apply architectural conventions to code (AWS SDK wrappers, entity mocks, response helpers, etc.).

Examples:
- AWS wrapper: {file: "src/lambdas/NewLambda/src/index.ts", convention: "aws-sdk-wrapper"}
- Entity mock: {file: "src/lambdas/NewLambda/src/index.ts", convention: "entity-mock"}
- Dry run: {file: "src/lambdas/NewLambda/src/index.ts", convention: "all", dryRun: true}`,
  inputSchema: {
    type: 'object',
    properties: {
      file: {type: 'string', description: 'File path to apply conventions to (relative to project root)'},
      convention: {
        type: 'string',
        description:
          'Convention to apply: aws-sdk-wrapper (vendor encapsulation), entity-mock (entity mocking), response-helper (Lambda responses), env-validation (getRequiredEnv), powertools (AWS Powertools), all (apply all)',
        enum: ['aws-sdk-wrapper', 'entity-mock', 'response-helper', 'env-validation', 'powertools', 'all']
      },
      dryRun: {type: 'boolean', description: 'If true, preview changes without modifying files. Default: false (applies changes)'}
    },
    required: ['file', 'convention']
  },
  handler: (args) => handleApplyConvention(args as unknown as ApplyConventionArgs)
}
