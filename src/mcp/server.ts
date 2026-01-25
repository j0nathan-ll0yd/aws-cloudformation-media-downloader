#!/usr/bin/env node
/**
 * Model Context Protocol (MCP) Server for Media Downloader
 *
 * Provides 24 queryable tools organized by category:
 * - Data queries: entities, lambdas, infrastructure, dependencies, conventions
 * - Validation: patterns, coverage, impact, tests, types, naming, semantics
 * - Refactoring: conventions, rename, migration, extract, inline
 * - Git: semantic diff, history, pattern consistency
 * - Performance: bundle size, cold start
 * - Cross-repo: convention sync, schema drift
 */

import {Server} from '@modelcontextprotocol/sdk/server/index.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {CallToolRequestSchema, ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js'
import {getAllToolDefinitions, getToolByName} from './tools/index.js'

// Create server instance
const server = new Server({name: 'media-downloader-mcp', version: '1.0.0'}, {capabilities: {tools: {}}})

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {tools: getAllToolDefinitions()}
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const {name, arguments: args} = request.params
  const tool = getToolByName(name)

  if (!tool) {
    return {content: [{type: 'text', text: `Error: Unknown tool: ${name}`}], isError: true}
  }

  try {
    return await tool.handler(args)
  } catch (error) {
    return {content: [{type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}`}], isError: true}
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MCP Server running on stdio')
}

main().catch(console.error)
