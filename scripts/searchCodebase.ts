import * as lancedb from '@lancedb/lancedb'
import {generateEmbedding} from './embeddings.js'

const DB_DIR = '.lancedb'
const TABLE_NAME = 'code_chunks'

async function search(query: string, limit = 5) {
  const db = await lancedb.connect(DB_DIR)
  const table = await db.openTable(TABLE_NAME)

  const vector = await generateEmbedding(query)
  const results = await table.vectorSearch(vector).limit(limit).toArray()

  console.log(`
Results for query: "${query}"
`)
  for (const result of results) {
    console.log(`--- Result (Distance: ${result._distance.toFixed(4)}) ---`)
    console.log(`File: ${result.filePath}:${result.startLine}`)
    console.log(`Type: ${result.type}, Name: ${result.name}`)
    console.log(`Preview: ${result.text.substring(0, 100).replace(/\n/g, ' ')}...`)
    console.log()
  }
}

const query = process.argv.slice(2).join(' ') || 'How is DynamoDB initialized?'
search(query).catch(console.error)
