/**
 * MCP Tool Definition types for the tool registry
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/MCP/Tool-Registry | Tool Registry}
 */

import type {McpResponse} from '../handlers/shared/response-types.js'

/**
 * MCP Tool Definition with handler reference
 */
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {type: 'object'; properties: Record<string, unknown>; required?: string[]}
  handler: (args: Record<string, unknown>) => Promise<McpResponse>
}
