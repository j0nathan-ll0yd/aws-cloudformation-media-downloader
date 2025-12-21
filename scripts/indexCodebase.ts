import * as lancedb from '@lancedb/lancedb'
import {Project} from 'ts-morph'
import {glob} from 'glob'
import * as path from 'node:path'
import {generateEmbedding} from './embeddings.js'

const DB_DIR = '.lancedb'
const TABLE_NAME = 'code_chunks'

interface CodeChunk {
  vector: number[]
  text: string
  filePath: string
  startLine: number
  endLine: number
  type: string
  name: string
  [key: string]: unknown  // Index signature for LanceDB compatibility
}

export async function indexCodebase() {
  const projectRoot = process.cwd()
  const db = await lancedb.connect(DB_DIR)

  // Find all TypeScript files
  const files = await glob('src/**/*.ts', {
    ignore: ['**/*.test.ts', '**/node_modules/**'],
    cwd: projectRoot
  })

  console.log(`Found ${files.length} files to index...`)

  const project = new Project()
  const chunks: CodeChunk[] = []

  for (const file of files) {
    const filePath = path.join(projectRoot, file)
    const sourceFile = project.addSourceFileAtPath(filePath)
    
    console.log(`Processing ${file}...`)

    // Extract classes
    for (const cls of sourceFile.getClasses()) {
      chunks.push(await createChunk(cls, 'class', cls.getName() || 'anonymous', file))
    }

    // Extract functions
    for (const func of sourceFile.getFunctions()) {
      chunks.push(await createChunk(func, 'function', func.getName() || 'anonymous', file))
    }

    // Extract exported interfaces
    for (const iface of sourceFile.getInterfaces()) {
      if (iface.isExported()) {
        chunks.push(await createChunk(iface, 'interface', iface.getName(), file))
      }
    }

    // Extract top-level variables (like entity definitions)
    for (const varStmt of sourceFile.getVariableStatements()) {
      if (varStmt.isExported()) {
        for (const decl of varStmt.getDeclarations()) {
          chunks.push(await createChunk(decl, 'variable', decl.getName(), file))
        }
      }
    }
  }

  console.log(`Generated ${chunks.length} chunks. Creating table...`)

  // Check if table exists, if so delete it to re-index
  const tableNames = await db.tableNames()
  if (tableNames.includes(TABLE_NAME)) {
    await db.dropTable(TABLE_NAME)
  }

  await db.createTable(TABLE_NAME, chunks)
  console.log('Successfully indexed codebase!')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createChunk(node: any, type: string, name: string, filePath: string): Promise<CodeChunk> {
  const text = node.getText()
  const startLine = node.getStartLineNumber()
  const endLine = node.getEndLineNumber()
  
  // Create a descriptive header for better embedding context
  const contextHeader = `File: ${filePath}\nType: ${type}\nName: ${name}\n\n`
  const vector = await generateEmbedding(contextHeader + text)

  return {
    vector,
    text,
    filePath,
    startLine,
    endLine,
    type,
    name
  }
}

// Run when executed directly
indexCodebase().catch(console.error)
