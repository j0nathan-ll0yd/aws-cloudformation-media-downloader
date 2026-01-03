import * as lancedb from '@lancedb/lancedb'
import path from 'node:path'
import {generateEmbedding} from '../../../scripts/embeddings.js'
import {indexCodebase} from '../../../scripts/indexCodebase.js'
import {createErrorResponse, createSuccessResponse, createTextResponse} from './shared/response-types.js'

const DB_DIR = path.join(process.cwd(), '.lancedb')
const TABLE_NAME = 'code_chunks'

export interface SemanticSearchArgs {
  query: string
  limit?: number
}

/**
 * Handle semantic search queries via LanceDB
 */
export async function handleSemanticSearch(args: SemanticSearchArgs) {
  try {
    const db = await lancedb.connect(DB_DIR)
    const tableNames = await db.tableNames()

    if (!tableNames.includes(TABLE_NAME)) {
      return createErrorResponse('Codebase has not been indexed yet', 'Run "pnpm run index:codebase" to create the semantic index')
    }

    const table = await db.openTable(TABLE_NAME)
    const vector = await generateEmbedding(args.query)
    const results = await table.vectorSearch(vector).limit(args.limit || 5).toArray()

    const formattedResults = results.map((result) => ({
      file: result.filePath,
      line: result.startLine,
      type: result.type,
      name: result.name,
      distance: result._distance,
      snippet: result.text.substring(0, 500) + (result.text.length > 500 ? '...' : '')
    }))

    return createSuccessResponse(formattedResults)
  } catch (error) {
    return createErrorResponse(`Semantic search failed: ${error instanceof Error ? error.message : String(error)}`,
      'Ensure the codebase is indexed with "pnpm run index:codebase"')
  }
}

/**
 * Handle codebase indexing
 */
export async function handleIndexCodebase() {
  try {
    await indexCodebase()
    return createTextResponse('Indexing completed successfully.')
  } catch (error) {
    return createErrorResponse(`Indexing failed: ${error instanceof Error ? error.message : String(error)}`, 'Check that LanceDB dependencies are installed')
  }
}
