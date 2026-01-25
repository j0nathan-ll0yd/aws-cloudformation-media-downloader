import {defineTool} from '../types.js'
import type {McpResponse} from '../../handlers/shared/response-types.js'

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
async function handleDependencyQuery(args: {file?: string; query: string}): Promise<McpResponse> {
  const fs = await import('fs/promises')
  const path = await import('path')

  const graphPath = path.join(process.cwd(), 'build', 'graph.json')
  const graphData: GraphData = JSON.parse(await fs.readFile(graphPath, 'utf-8'))

  const {file, query} = args

  switch (query) {
    case 'imports': {
      if (!file) {
        return {content: [{type: 'text', text: 'File path required for imports query'}]}
      }
      const imports = graphData.graph[file]?.imports || []
      return {content: [{type: 'text', text: JSON.stringify({file, imports}, null, 2)}]}
    }

    case 'transitive': {
      if (!file) {
        return {content: [{type: 'text', text: 'File path required for transitive dependencies query'}]}
      }
      const transitive = graphData.transitiveDependencies[file] || []
      return {content: [{type: 'text', text: JSON.stringify({file, transitiveDependencies: transitive}, null, 2)}]}
    }

    case 'circular':
      return {content: [{type: 'text', text: JSON.stringify({circularDependencies: graphData.circularDependencies || []}, null, 2)}]}

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
        return {content: [{type: 'text', text: JSON.stringify(dependents, null, 2)}]}
      } else {
        // Find who imports this specific file
        const dependents: string[] = []
        for (const [sourceFile, data] of Object.entries(graphData.graph)) {
          if (data.imports?.includes(file)) {
            dependents.push(sourceFile)
          }
        }
        return {content: [{type: 'text', text: JSON.stringify({file, dependents}, null, 2)}]}
      }
    }

    default:
      return {content: [{type: 'text', text: `Unknown query type: ${query}`}]}
  }
}

export const queryDependenciesTool = defineTool({
  name: 'query_dependencies',
  description: `Query code dependencies from graph.json.

Examples:
- Find circular deps: {"query": "circular"}
- Get file imports: {"file": "src/lambdas/ListFiles/src/index.ts", "query": "imports"}`,
  inputSchema: {
    type: 'object',
    properties: {
      file: {type: 'string', description: 'File path to analyze'},
      query: {
        type: 'string',
        description: 'Query type (imports, dependents, transitive, circular)',
        enum: ['imports', 'dependents', 'transitive', 'circular']
      }
    },
    required: ['query']
  },
  handler: handleDependencyQuery as (args: unknown) => Promise<McpResponse>
})
