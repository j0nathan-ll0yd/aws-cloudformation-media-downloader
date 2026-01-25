#!/usr/bin/env node
/**
 * Model Context Protocol (MCP) Server for Media Downloader
 * Provides queryable interfaces for:
 * - Entity schemas and relationships (Drizzle ORM with Aurora DSQL)
 * - Lambda function configurations
 * - AWS infrastructure queries
 * - Dependency graph analysis
 * - Project conventions and patterns
 * - Code validation and coverage analysis
 * - Impact analysis and test scaffolding
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/MCP/Server | MCP Server}
 */

import {Server} from '@modelcontextprotocol/sdk/server/index.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {CallToolRequestSchema, ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js'
import {getToolByName, getToolDefinitions} from './tools/index.js'
import {createErrorResponse} from './handlers/shared/response-types.js'

// Create server instance
const server = new Server({name: 'media-downloader-mcp', version: '1.0.0'}, {capabilities: {tools: {}}})

// List all available tools from registry
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {tools: getToolDefinitions()}
})

// Handle tool calls via registry
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const {name, arguments: args = {}} = request.params
  const tool = getToolByName(name)

  if (!tool) {
    return createErrorResponse(`Unknown tool: ${name}`, 'Use ListTools to see available tools')
  }

  try {
    return await tool.handler(args)
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : String(error))
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MCP Server running on stdio')
}

main().catch(console.error)
