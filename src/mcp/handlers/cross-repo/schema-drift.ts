/**
 * Schema Drift Detection MCP Handler
 *
 * Detects discrepancies between Drizzle ORM schema definitions and SQL migrations.
 * Helps prevent production issues from undetected schema mismatches.
 *
 * Features:
 * - Extract table definitions from Drizzle schema (src/lib/vendor/Drizzle/schema.ts)
 * - Parse migration SQL files to understand expected database state
 * - Compare and report discrepancies
 */

import {promises as fs} from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
import {Project, SyntaxKind} from 'ts-morph'
import {createErrorResponse, createSuccessResponse} from '../shared/response-types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../..')

export type SchemaDriftQueryType = 'check' | 'tables' | 'columns' | 'indexes'

export interface SchemaDriftArgs {
  query: SchemaDriftQueryType
  table?: string
}

interface DrizzleColumn {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string
  primaryKey: boolean
}

interface DrizzleTable {
  name: string
  columns: DrizzleColumn[]
  indexes: string[]
}

interface MigrationColumn {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string
  primaryKey: boolean
}

interface MigrationTable {
  name: string
  columns: MigrationColumn[]
  indexes: string[]
  compositeKey?: string[]
}

interface SchemaDrift {
  table: string
  type: 'missing_in_schema' | 'missing_in_migration' | 'column_mismatch' | 'index_mismatch' | 'type_mismatch'
  details: string
  severity: 'high' | 'medium' | 'low'
}

/**
 * Extract table definitions from Drizzle schema using ts-morph
 */
async function extractDrizzleTables(): Promise<DrizzleTable[]> {
  const project = new Project({tsConfigFilePath: path.join(projectRoot, 'tsconfig.json')})
  const schemaPath = path.join(projectRoot, 'src/lib/vendor/Drizzle/schema.ts')
  const sourceFile = project.getSourceFile(schemaPath)

  if (!sourceFile) {
    throw new Error('Could not find Drizzle schema file')
  }

  const tables: DrizzleTable[] = []

  // Find all pgTable calls (variable declarations)
  const variableDecls = sourceFile.getVariableDeclarations()

  for (const decl of variableDecls) {
    const initializer = decl.getInitializer()
    if (!initializer) {
      continue
    }

    const callExpr = initializer.asKind(SyntaxKind.CallExpression)
    if (!callExpr) {
      continue
    }

    const exprText = callExpr.getExpression().getText()
    if (exprText !== 'pgTable') {
      continue
    }

    const args = callExpr.getArguments()
    if (args.length < 2) {
      continue
    }

    // First arg is table name (string literal)
    const tableNameArg = args[0]
    const tableName = tableNameArg.getText().replace(/['"]/g, '')

    // Second arg is columns object literal
    const columnsArg = args[1]
    const columns: DrizzleColumn[] = []
    const indexes: string[] = []

    // Parse columns from object literal
    if (columnsArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
      for (const prop of columnsArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression).getProperties()) {
        if (!prop.isKind(SyntaxKind.PropertyAssignment)) {
          continue
        }

        const propAssign = prop.asKindOrThrow(SyntaxKind.PropertyAssignment)
        const columnName = propAssign.getName()
        const columnDef = propAssign.getInitializer()?.getText() || ''

        // Parse column definition
        const column: DrizzleColumn = {
          name: columnName,
          type: extractColumnType(columnDef),
          nullable: !columnDef.includes('.notNull()'),
          defaultValue: extractDefaultValue(columnDef),
          primaryKey: columnDef.includes('.primaryKey()')
        }

        columns.push(column)
      }
    }

    // Third arg (optional) is callback for indexes
    if (args.length >= 3) {
      const indexArg = args[2]
      const indexText = indexArg.getText()

      // Extract index names from the callback
      const indexMatches = indexText.match(/index\(['"]([^'"]+)['"]\)/g)
      if (indexMatches) {
        for (const match of indexMatches) {
          const indexName = match.match(/index\(['"]([^'"]+)['"]\)/)?.[1]
          if (indexName) {
            indexes.push(indexName)
          }
        }
      }

      // Extract unique constraint names
      const uniqueMatches = indexText.match(/unique\(['"]([^'"]+)['"]\)/g)
      if (uniqueMatches) {
        for (const match of uniqueMatches) {
          const uniqueName = match.match(/unique\(['"]([^'"]+)['"]\)/)?.[1]
          if (uniqueName) {
            indexes.push(uniqueName)
          }
        }
      }
    }

    tables.push({name: tableName, columns, indexes})
  }

  return tables
}

/**
 * Extract column type from Drizzle column definition
 */
function extractColumnType(def: string): string {
  const typeMatches: [RegExp, string][] = [
    [/^uuid\(/, 'UUID'],
    [/^text\(/, 'TEXT'],
    [/^boolean\(/, 'BOOLEAN'],
    [/^integer\(/, 'INTEGER'],
    [/^timestamp\(/, 'TIMESTAMP WITH TIME ZONE']
  ]

  for (const [pattern, sqlType] of typeMatches) {
    if (pattern.test(def)) {
      return sqlType
    }
  }

  return 'UNKNOWN'
}

/**
 * Extract default value from Drizzle column definition
 */
function extractDefaultValue(def: string): string | undefined {
  if (def.includes('.defaultRandom()')) {
    return 'gen_random_uuid()'
  }
  if (def.includes('.defaultNow()')) {
    return 'NOW()'
  }
  if (def.includes('.default(false)')) {
    return 'FALSE'
  }
  if (def.includes('.default(true)')) {
    return 'TRUE'
  }
  if (def.includes('.default(0)')) {
    return '0'
  }

  const stringDefault = def.match(/\.default\(['"]([^'"]+)['"]\)/)
  if (stringDefault) {
    return `'${stringDefault[1]}'`
  }

  return undefined
}

/**
 * Parse migration SQL files to extract table definitions
 */
async function extractMigrationTables(): Promise<MigrationTable[]> {
  const migrationsDir = path.join(projectRoot, 'migrations')
  const files = await fs.readdir(migrationsDir)
  const sqlFiles = files.filter((f) => f.endsWith('.sql') && !f.includes('lambda_roles'))

  const tables: Map<string, MigrationTable> = new Map()

  for (const file of sqlFiles) {
    const content = await fs.readFile(path.join(migrationsDir, file), 'utf-8')
    const parsedTables = parseSqlCreateTables(content)
    const parsedIndexes = parseSqlIndexes(content)

    for (const table of parsedTables) {
      tables.set(table.name, table)
    }

    // Merge indexes into tables
    for (const [tableName, indexNames] of parsedIndexes) {
      const table = tables.get(tableName)
      if (table) {
        table.indexes.push(...indexNames)
      }
    }
  }

  return Array.from(tables.values())
}

/**
 * Parse CREATE TABLE statements from SQL
 */
function parseSqlCreateTables(sql: string): MigrationTable[] {
  const tables: MigrationTable[] = []

  // Match CREATE TABLE statements
  const tableRegex = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\);/gi
  let match: RegExpExecArray | null

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1]
    const columnsBlock = match[2]

    // Skip schema_migrations table
    if (tableName === 'schema_migrations') {
      continue
    }

    const columns: MigrationColumn[] = []
    let compositeKey: string[] | undefined

    // Split by commas but respect parentheses
    const parts = splitColumnsBlock(columnsBlock)

    for (const part of parts) {
      const trimmed = part.trim()

      // Check for PRIMARY KEY constraint
      if (trimmed.toUpperCase().startsWith('PRIMARY KEY')) {
        const keyMatch = trimmed.match(/PRIMARY KEY\s*\(([^)]+)\)/i)
        if (keyMatch) {
          compositeKey = keyMatch[1].split(',').map((k) => k.trim())
        }
        continue
      }

      // Skip if it's not a column definition (constraints, etc.)
      if (!trimmed || /^(CONSTRAINT|FOREIGN KEY|UNIQUE|CHECK)/i.test(trimmed)) {
        continue
      }

      // Parse column definition
      const colMatch = trimmed.match(/^(\w+)\s+([A-Z\s()]+)(.*)$/i)
      if (colMatch) {
        const name = colMatch[1]
        let type = colMatch[2].trim()
        const modifiers = colMatch[3]

        // Normalize type
        if (type.includes('TIMESTAMP')) {
          type = 'TIMESTAMP WITH TIME ZONE'
        }

        const column: MigrationColumn = {
          name,
          type: type.replace(/\s+/g, ' ').toUpperCase().trim(),
          nullable: !modifiers.toUpperCase().includes('NOT NULL'),
          defaultValue: extractSqlDefault(modifiers),
          primaryKey: modifiers.toUpperCase().includes('PRIMARY KEY')
        }

        columns.push(column)
      }
    }

    tables.push({name: tableName, columns, indexes: [], compositeKey})
  }

  return tables
}

/**
 * Split columns block respecting parentheses
 */
function splitColumnsBlock(block: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0

  for (const char of block) {
    if (char === '(') {
      depth++
    } else if (char === ')') {
      depth--
    }

    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts
}

/**
 * Extract DEFAULT value from SQL column modifiers
 */
function extractSqlDefault(modifiers: string): string | undefined {
  const defaultMatch = modifiers.match(/DEFAULT\s+([^\s,]+(?:\([^)]*\))?)/i)
  if (defaultMatch) {
    return defaultMatch[1].trim()
  }
  return undefined
}

/**
 * Parse CREATE INDEX statements from SQL
 */
function parseSqlIndexes(sql: string): Map<string, string[]> {
  const indexes = new Map<string, string[]>()

  // Match CREATE INDEX statements
  const indexRegex = /CREATE INDEX (?:ASYNC )?IF NOT EXISTS (\w+) ON (\w+)/gi
  let match: RegExpExecArray | null

  while ((match = indexRegex.exec(sql)) !== null) {
    const indexName = match[1]
    const tableName = match[2]

    if (!indexes.has(tableName)) {
      indexes.set(tableName, [])
    }
    indexes.get(tableName)!.push(indexName)
  }

  return indexes
}

/**
 * Compare Drizzle schema with migration SQL and detect drift
 */
function detectDrift(drizzleTables: DrizzleTable[], migrationTables: MigrationTable[]): SchemaDrift[] {
  const drifts: SchemaDrift[] = []
  const drizzleByName = new Map(drizzleTables.map((t) => [t.name, t]))
  const migrationByName = new Map(migrationTables.map((t) => [t.name, t]))

  // Check for tables in Drizzle but not in migrations
  for (const [name, drizzle] of drizzleByName) {
    if (!migrationByName.has(name)) {
      drifts.push({table: name, type: 'missing_in_migration', details: `Table '${name}' exists in Drizzle schema but not in migrations`, severity: 'high'})
      continue
    }

    const migration = migrationByName.get(name)!

    // Compare columns
    const drizzleCols = new Map(drizzle.columns.map((c) => [c.name, c]))

    // Convert snake_case to camelCase for comparison
    const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    const migrationColsNormalized = new Map(migration.columns.map((c) => [snakeToCamel(c.name), c]))

    for (const [colName, drizzleCol] of drizzleCols) {
      const migrationCol = migrationColsNormalized.get(colName)

      if (!migrationCol) {
        drifts.push({
          table: name,
          type: 'column_mismatch',
          details: `Column '${colName}' exists in Drizzle but not in migration for table '${name}'`,
          severity: 'high'
        })
        continue
      }

      // Check type mismatch
      if (drizzleCol.type !== migrationCol.type) {
        drifts.push({
          table: name,
          type: 'type_mismatch',
          details: `Column '${colName}' type mismatch in '${name}': Drizzle=${drizzleCol.type}, Migration=${migrationCol.type}`,
          severity: 'medium'
        })
      }

      // Check nullable mismatch (only if significant)
      if (drizzleCol.nullable !== migrationCol.nullable && !drizzleCol.primaryKey) {
        drifts.push({
          table: name,
          type: 'column_mismatch',
          details: `Column '${colName}' nullable mismatch in '${name}': Drizzle=${drizzleCol.nullable}, Migration=${migrationCol.nullable}`,
          severity: 'low'
        })
      }
    }

    // Check for columns in migration but not in Drizzle
    for (const migCol of migration.columns) {
      const camelName = snakeToCamel(migCol.name)
      if (!drizzleCols.has(camelName)) {
        drifts.push({
          table: name,
          type: 'column_mismatch',
          details: `Column '${migCol.name}' exists in migration but not in Drizzle for table '${name}'`,
          severity: 'medium'
        })
      }
    }

    // Compare indexes
    const drizzleIndexes = new Set(drizzle.indexes)
    const migrationIndexes = new Set(migration.indexes)

    for (const idx of drizzleIndexes) {
      if (!migrationIndexes.has(idx)) {
        drifts.push({
          table: name,
          type: 'index_mismatch',
          details: `Index '${idx}' exists in Drizzle but not in migration for table '${name}'`,
          severity: 'low'
        })
      }
    }

    for (const idx of migrationIndexes) {
      if (!drizzleIndexes.has(idx)) {
        drifts.push({
          table: name,
          type: 'index_mismatch',
          details: `Index '${idx}' exists in migration but not in Drizzle for table '${name}'`,
          severity: 'low'
        })
      }
    }
  }

  // Check for tables in migrations but not in Drizzle
  for (const [name] of migrationByName) {
    if (!drizzleByName.has(name)) {
      drifts.push({table: name, type: 'missing_in_schema', details: `Table '${name}' exists in migrations but not in Drizzle schema`, severity: 'high'})
    }
  }

  return drifts
}

/**
 * Main handler for schema drift queries
 */
export async function handleSchemaDriftQuery(args: SchemaDriftArgs) {
  const {query, table} = args

  try {
    switch (query) {
      case 'check': {
        const drizzleTables = await extractDrizzleTables()
        const migrationTables = await extractMigrationTables()
        let drifts = detectDrift(drizzleTables, migrationTables)

        // Filter by table if specified
        if (table) {
          drifts = drifts.filter((d) => d.table === table)
        }

        // Calculate severity distribution
        const bySeverity = {
          high: drifts.filter((d) => d.severity === 'high').length,
          medium: drifts.filter((d) => d.severity === 'medium').length,
          low: drifts.filter((d) => d.severity === 'low').length
        }

        return createSuccessResponse({
          hasDrift: drifts.length > 0,
          totalDrifts: drifts.length,
          bySeverity,
          drifts,
          recommendation: bySeverity.high > 0
            ? `CRITICAL: ${bySeverity.high} high-severity schema drifts detected. Sync schema and migrations immediately.`
            : bySeverity.medium > 0
            ? `WARNING: ${bySeverity.medium} medium-severity drifts. Review for potential issues.`
            : drifts.length > 0
            ? `INFO: ${drifts.length} minor schema variations detected.`
            : 'Schema and migrations are in sync.'
        })
      }

      case 'tables': {
        const drizzleTables = await extractDrizzleTables()
        const migrationTables = await extractMigrationTables()

        return createSuccessResponse({
          drizzleTables: drizzleTables.map((t) => ({name: t.name, columnCount: t.columns.length, indexCount: t.indexes.length})),
          migrationTables: migrationTables.map((t) => ({name: t.name, columnCount: t.columns.length, indexCount: t.indexes.length})),
          comparison: {
            inBoth: drizzleTables.filter((dt) => migrationTables.some((mt) => mt.name === dt.name)).map((t) => t.name),
            onlyInDrizzle: drizzleTables.filter((dt) => !migrationTables.some((mt) => mt.name === dt.name)).map((t) => t.name),
            onlyInMigration: migrationTables.filter((mt) => !drizzleTables.some((dt) => dt.name === mt.name)).map((t) => t.name)
          }
        })
      }

      case 'columns': {
        if (!table) {
          return createErrorResponse('Table name required for columns query', 'Use table parameter to specify the table')
        }

        const drizzleTables = await extractDrizzleTables()
        const migrationTables = await extractMigrationTables()

        const drizzleTable = drizzleTables.find((t) => t.name === table)
        const migrationTable = migrationTables.find((t) => t.name === table)

        if (!drizzleTable && !migrationTable) {
          return createErrorResponse(`Table '${table}' not found in schema or migrations`)
        }

        return createSuccessResponse({
          table,
          drizzleColumns: drizzleTable?.columns || [],
          migrationColumns: migrationTable?.columns || [],
          status: drizzleTable && migrationTable ? 'exists_in_both' : drizzleTable ? 'only_in_drizzle' : 'only_in_migration'
        })
      }

      case 'indexes': {
        const drizzleTables = await extractDrizzleTables()
        const migrationTables = await extractMigrationTables()

        const allIndexes: {table: string; index: string; source: 'drizzle' | 'migration' | 'both'}[] = []

        for (const dt of drizzleTables) {
          const mt = migrationTables.find((t) => t.name === dt.name)
          const migrationIndexes = new Set(mt?.indexes || [])

          for (const idx of dt.indexes) {
            allIndexes.push({table: dt.name, index: idx, source: migrationIndexes.has(idx) ? 'both' : 'drizzle'})
          }

          if (mt) {
            for (const idx of mt.indexes) {
              if (!dt.indexes.includes(idx)) {
                allIndexes.push({table: dt.name, index: idx, source: 'migration'})
              }
            }
          }
        }

        // Filter by table if specified
        const filtered = table ? allIndexes.filter((i) => i.table === table) : allIndexes

        return createSuccessResponse({
          totalIndexes: filtered.length,
          bySource: {
            both: filtered.filter((i) => i.source === 'both').length,
            drizzleOnly: filtered.filter((i) => i.source === 'drizzle').length,
            migrationOnly: filtered.filter((i) => i.source === 'migration').length
          },
          indexes: filtered
        })
      }

      default:
        return createErrorResponse(`Unknown query type: ${query}`, 'Available queries: check, tables, columns, indexes')
    }
  } catch (error) {
    return createErrorResponse(`Schema drift analysis failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
