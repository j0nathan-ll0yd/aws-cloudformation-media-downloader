import fs from 'node:fs'
import path from 'node:path'
import * as lancedb from '@lancedb/lancedb'
import {search} from '../../../scripts/searchCodebase.js'
import {indexCodebase} from '../../../scripts/indexCodebase.js'
import {createErrorResponse, createSuccessResponse, createTextResponse} from './shared/response-types.js'

const DB_DIR = path.join(process.cwd(), '.lancedb')
const TABLE_NAME = 'code_chunks'
const METADATA_FILE = path.join(DB_DIR, 'metadata.json')
const STALE_THRESHOLD_DAYS = 7

interface IndexMetadata {
  indexedAt: string
  filesIndexed?: number
  version?: string
}

/**
 * Read index metadata to check freshness
 */
function readIndexMetadata(): IndexMetadata | null {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const content = fs.readFileSync(METADATA_FILE, 'utf-8')
      return JSON.parse(content) as IndexMetadata
    }
  } catch {
    // Ignore read errors
  }
  return null
}

/**
 * Write index metadata after indexing
 */
function writeIndexMetadata(metadata: IndexMetadata): void {
  try {
    fs.mkdirSync(DB_DIR, {recursive: true})
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2))
  } catch {
    // Ignore write errors
  }
}

/**
 * Check if index is stale (older than threshold)
 */
function getIndexAge(): {days: number; isStale: boolean; indexedAt: string | null} {
  const metadata = readIndexMetadata()
  if (!metadata?.indexedAt) {
    return {days: -1, isStale: true, indexedAt: null}
  }

  const indexedDate = new Date(metadata.indexedAt)
  const now = new Date()
  const diffMs = now.getTime() - indexedDate.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  return {days, isStale: days >= STALE_THRESHOLD_DAYS, indexedAt: metadata.indexedAt}
}

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
      return createErrorResponse('Codebase has not been indexed yet', 'Run "pnpm run index:codebase" to create the semantic index')
    }

    // Check index freshness
    const indexAge = getIndexAge()

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

    // Include freshness warning if index is stale
    const response = createSuccessResponse(formattedResults)
    if (indexAge.isStale) {
      const warning = indexAge.indexedAt
        ? `Warning: Semantic index is ${indexAge.days} days old. Run "pnpm run index:codebase" to refresh.`
        : 'Warning: Index age unknown. Run "pnpm run index:codebase" to refresh.'
      return {...response, warning, indexedAt: indexAge.indexedAt, indexAgeDays: indexAge.days}
    }

    return {...response, indexedAt: indexAge.indexedAt, indexAgeDays: indexAge.days}
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

    // Write metadata for freshness tracking
    writeIndexMetadata({indexedAt: new Date().toISOString(), version: '1.0'})

    return createTextResponse('Indexing completed successfully. Index freshness metadata updated.')
  } catch (error) {
    return createErrorResponse(`Indexing failed: ${error instanceof Error ? error.message : String(error)}`, 'Check that LanceDB dependencies are installed')
  }
}
