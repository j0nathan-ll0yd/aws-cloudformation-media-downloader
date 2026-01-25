/**
 * Dependency graph query handler for MCP server
 * Provides analysis of code dependencies from graph.json
 */

import {createErrorResponse, createSuccessResponse} from './shared/response-types.js'

interface GraphFileData {
  imports?: string[]
}

interface GraphData {
  graph: Record<string, GraphFileData>
  transitiveDependencies: Record<string, string[]>
  circularDependencies?: string[][]
}

/**
 * Handle dependency graph queries
 */
export async function handleDependencyQuery(args: {file?: string; query: string}) {
  const fs = await import('fs/promises')
  const path = await import('path')

  const graphPath = path.join(process.cwd(), 'build', 'graph.json')
  const graphData: GraphData = JSON.parse(await fs.readFile(graphPath, 'utf-8'))

  const {file, query} = args

  switch (query) {
    case 'imports': {
      if (!file) {
        return createErrorResponse('File path required for imports query', 'Example: {file: "src/lambdas/ListFiles/src/index.ts", query: "imports"}')
      }
      const imports = graphData.graph[file]?.imports || []
      return createSuccessResponse({file, imports})
    }

    case 'transitive': {
      if (!file) {
        return createErrorResponse('File path required for transitive dependencies query',
          'Example: {file: "src/lambdas/ListFiles/src/index.ts", query: "transitive"}')
      }
      const transitive = graphData.transitiveDependencies[file] || []
      return createSuccessResponse({file, transitiveDependencies: transitive})
    }

    case 'circular':
      return createSuccessResponse({circularDependencies: graphData.circularDependencies || []})

    case 'dependents': {
      if (!file) {
        // List all files with their dependent counts
        const dependents: Record<string, string[]> = {}
        for (const [sourceFile, data] of Object.entries(graphData.graph)) {
          for (const importedFile of data.imports || []) {
            if (!dependents[importedFile]) {
              dependents[importedFile] = []
            }
            dependents[importedFile].push(sourceFile)
          }
        }
        return createSuccessResponse(dependents)
      } else {
        // Find who imports this specific file
        const dependents: string[] = []
        for (const [sourceFile, data] of Object.entries(graphData.graph)) {
          if (data.imports?.includes(file)) {
            dependents.push(sourceFile)
          }
        }
        return createSuccessResponse({file, dependents})
      }
    }

    default:
      return createErrorResponse(`Unknown query type: ${query}`, 'Available queries: imports, dependents, transitive, circular')
  }
}
