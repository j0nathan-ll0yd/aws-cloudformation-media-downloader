/**
 * Shared types for MCP tool definitions
 */
import type {McpResponse} from '../handlers/shared/response-types.js'

/**
 * Schema definition for tool input parameters
 */
export interface ToolInputSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}

/**
 * Definition for a single MCP tool
 */
export interface ToolDefinition<TArgs = unknown> {
  name: string
  description: string
  inputSchema: ToolInputSchema
  handler: (args: TArgs) => Promise<McpResponse>
}

/**
 * Helper to define a tool with type inference
 */
export function defineTool<TArgs>(tool: ToolDefinition<TArgs>): ToolDefinition<TArgs> {
  return tool
}
