/**
 * MCP Tool Registry
 *
 * Auto-registers all 24 tools from their respective category directories.
 */
import type {ToolDefinition} from './types.js'

// Data query tools
import {queryConventionsTool, queryDependenciesTool, queryEntitiesTool, queryInfrastructureTool, queryLambdaTool} from './data-queries/index.js'

// Validation tools
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

// Refactoring tools
import {
  applyConventionTool,
  generateMigrationTool,
  refactorExtractModuleTool,
  refactorInlineConstantTool,
  refactorRenameSymbolTool
} from './refactoring/index.js'

// Git tools
import {analyzePatternConsistencyTool, diffSemanticTool, queryGitHistoryTool} from './git/index.js'

// Performance tools
import {analyzeBundleSizeTool, analyzeColdStartTool} from './performance/index.js'

// Cross-repo tools
import {checkSchemaDriftTool, syncConventionsTool} from './cross-repo/index.js'

/**
 * Complete registry of all MCP tools
 */
export const toolRegistry: ToolDefinition[] = [
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
  refactorRenameSymbolTool,
  generateMigrationTool,
  refactorExtractModuleTool,
  refactorInlineConstantTool,
  // Git
  diffSemanticTool,
  queryGitHistoryTool,
  analyzePatternConsistencyTool,
  // Performance
  analyzeBundleSizeTool,
  analyzeColdStartTool,
  // Cross-repo
  syncConventionsTool,
  checkSchemaDriftTool
]

/**
 * Get a tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return toolRegistry.find((t) => t.name === name)
}

/**
 * Get all tool definitions for ListTools response
 */
export function getAllToolDefinitions() {
  return toolRegistry.map(({name, description, inputSchema}) => ({name, description, inputSchema}))
}

// Re-export types
export type { ToolDefinition, ToolInputSchema } from './types.js'
