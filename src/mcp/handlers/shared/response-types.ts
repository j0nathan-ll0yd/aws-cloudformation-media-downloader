/**
 * Standardized MCP response types following 2025-11-25 spec
 *
 * According to MCP spec, tool execution errors MUST be reported within
 * the result object using `isError: true`, NOT as protocol-level errors.
 * This allows the LLM to see and potentially handle the error.
 */

/**
 * MCP content block structure
 */
export interface McpContentBlock {
  type: 'text'
  text: string
}

/**
 * Standardized MCP error response
 * Tool errors use content with isError flag, NOT protocol errors
 * Index signature allows compatibility with MCP SDK's ServerResult type
 */
export interface McpErrorResponse {
  [key: string]: unknown
  content: McpContentBlock[]
  isError: true
}

/**
 * Standardized MCP success response
 * Index signature allows compatibility with MCP SDK's ServerResult type
 */
export interface McpSuccessResponse {
  [key: string]: unknown
  content: McpContentBlock[]
  isError?: false
}

/**
 * Union type for all MCP responses
 */
export type McpResponse = McpErrorResponse | McpSuccessResponse

/**
 * Create a standardized error response following MCP 2025-11-25 spec
 *
 * @param message - The error message to display
 * @param hint - Optional hint for how to resolve the error
 * @returns MCP-compliant error response with isError: true
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/MCP/Convention-Tools#response-helpers | Response Helpers}
 */
export function createErrorResponse(message: string, hint?: string): McpErrorResponse {
  const text = hint ? `Error: ${message}\n\nHint: ${hint}` : `Error: ${message}`
  return {content: [{type: 'text', text}], isError: true}
}

/**
 * Create a standardized success response following MCP 2025-11-25 spec
 *
 * @param data - The data to include in the response (will be JSON stringified)
 * @returns MCP-compliant success response
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/MCP/Convention-Tools#response-helpers | Response Helpers}
 */
export function createSuccessResponse<T>(data: T): McpSuccessResponse {
  return {content: [{type: 'text', text: JSON.stringify(data, null, 2)}]}
}

/**
 * Create a text-only success response (no JSON serialization)
 *
 * @param text - The text content to return
 * @returns MCP-compliant success response with raw text
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/MCP/Convention-Tools#response-helpers | Response Helpers}
 */
export function createTextResponse(text: string): McpSuccessResponse {
  return {content: [{type: 'text', text}]}
}
