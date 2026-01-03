import path from 'node:path'
import * as lancedb from '@lancedb/lancedb'
import {search} from '../../../scripts/searchCodebase.js'
import {indexCodebase} from '../../../scripts/indexCodebase.js'

const DB_DIR = path.join(process.cwd(), '.lancedb')
const TABLE_NAME = 'code_chunks'

export interface SemanticSearchArgs {
  query: string
  limit?: number
  expandQuery?: boolean
}

/**
 * Handle semantic search queries via LanceDB with optional query expansion
 */
export async function handleSemanticSearch(args: SemanticSearchArgs) {
  try {
    const db = await lancedb.connect(DB_DIR)
    const tableNames = await db.tableNames()

    if (!tableNames.includes(TABLE_NAME)) {
      return {content: [{type: 'text', text: 'Codebase has not been indexed yet. Please run "pnpm run index:codebase" first.'}]}
    }

    // Use the improved search function with query expansion
    const results = await search(args.query, {
      limit: args.limit || 5,
      expand: args.expandQuery !== false // Default to true
    })

    const formattedResults = results.map((result) => ({
      file: result.filePath,
      line: result.startLine,
      type: result.type,
      name: result.name,
      distance: result._distance,
      adjustedDistance: result.adjustedDistance,
      snippet: result.text.substring(0, 500) + (result.text.length > 500 ? '...' : '')
    }))

    return {content: [{type: 'text', text: JSON.stringify(formattedResults, null, 2)}]}
  } catch (error) {
    return {content: [{type: 'text', text: `Error during semantic search: ${error instanceof Error ? error.message : String(error)}`}]}
  }
}

/**
 * Handle codebase indexing
 */
export async function handleIndexCodebase() {
  try {
    await indexCodebase()
    return {content: [{type: 'text', text: 'Indexing completed successfully.'}]}
  } catch (error) {
    return {content: [{type: 'text', text: `Indexing failed: ${error instanceof Error ? error.message : String(error)}`}]}
  }
}
