import * as lancedb from '@lancedb/lancedb'
import {generateEmbedding} from '../../../scripts/embeddings.js'
import path from 'node:path'

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
      return {content: [{type: 'text', text: 'Codebase has not been indexed yet. Please run "pnpm run index:codebase" first.'}]}
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

    return {content: [{type: 'text', text: JSON.stringify(formattedResults, null, 2)}]}
  } catch (error) {
    return {content: [{type: 'text', text: `Error during semantic search: ${error instanceof Error ? error.message : String(error)}`}]}
  }
}

/**
 * Handle codebase indexing
 */
export async function handleIndexCodebase() {
  // Since indexing is a heavy operation, we'll trigger it as a shell command
  // but we can wrap the logic if needed. For now, we'll just suggest running the script
  // or use exec to run it.
  const {exec} = await import('node:child_process')
  const {promisify} = await import('node:util')
  const execAsync = promisify(exec)

  try {
    const {stdout, stderr} = await execAsync('pnpm run index:codebase')
    return {content: [{type: 'text', text: `Indexing completed:\n${stdout}\n${stderr}`}]}
  } catch (error) {
    return {content: [{type: 'text', text: `Indexing failed: ${error instanceof Error ? error.message : String(error)}`}]}
  }
}
