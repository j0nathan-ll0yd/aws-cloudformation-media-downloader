/**
 * MCP Tool Registry
 * Central registration point for all MCP tools with auto-discovery
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/MCP/Tool-Registry | Tool Registry}
 */

import type {ToolDefinition} from './types.js'

// Data queries
import {queryConventionsTool, queryDependenciesTool, queryEntitiesTool, queryInfrastructureTool, queryLambdaTool} from './data-queries/index.js'

// Validation
import {
  checkCoverageTool,
  checkTypeAlignmentTool,
  indexCodebaseTool,
  lambdaImpactTool,
  searchCodebaseSemanticsTool,
  suggestTestsTool,
  validateNamingTool,
  validatePatternTool
} from './validation/index.js'

// Refactoring
import {applyConventionTool, extractModuleTool, generateMigrationTool, inlineConstantTool, renameSymbolTool} from './refactoring/index.js'

// Git
import {analyzePatternConsistencyTool, queryGitHistoryTool, semanticDiffTool, syncConventionsTool} from './git/index.js'

// Performance
import {analyzeBundleSizeTool, analyzeColdStartTool} from './performance/index.js'

// Cross-repo
import {checkSchemaDriftTool} from './cross-repo/index.js'

/**
 * All registered MCP tools
 */
export const tools: ToolDefinition[] = [
  // Data queries
  queryEntitiesTool,
  queryLambdaTool,
  queryInfrastructureTool,
  queryDependenciesTool,
  queryConventionsTool,

  // Validation
  validatePatternTool,
  checkCoverageTool,
  lambdaImpactTool,
  suggestTestsTool,
  checkTypeAlignmentTool,
  validateNamingTool,
  indexCodebaseTool,
  searchCodebaseSemanticsTool,

  // Refactoring
  applyConventionTool,
  renameSymbolTool,
  extractModuleTool,
  inlineConstantTool,
  generateMigrationTool,

  // Git
  semanticDiffTool,
  queryGitHistoryTool,
  analyzePatternConsistencyTool,
  syncConventionsTool,

  // Performance
  analyzeBundleSizeTool,
  analyzeColdStartTool,

  // Cross-repo
  checkSchemaDriftTool
]

/**
 * Get tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name)
}

/**
 * Get tool definitions for MCP ListTools response
 */
export function getToolDefinitions() {
  return tools.map(({name, description, inputSchema}) => ({name, description, inputSchema}))
}

export type { ToolDefinition }
