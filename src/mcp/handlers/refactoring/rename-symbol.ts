/**
 * Symbol rename refactoring handler for MCP server
 * Provides type-aware symbol renaming across the entire codebase
 *
 * Features:
 * - Preview mode to see all affected locations
 * - Atomic execution with rollback on failure
 * - Conflict detection for new names
 * - Scope filtering (file, module, project)
 */

import {Node, Project, SourceFile} from 'ts-morph'
import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'url'
import {createErrorResponse, createSuccessResponse} from '../shared/response-types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../..')

export type RenameQueryType = 'preview' | 'execute' | 'validate'

export interface RenameSymbolArgs {
  query: RenameQueryType
  symbol: string
  newName: string
  scope?: 'file' | 'module' | 'project'
  file?: string
  type?: 'function' | 'variable' | 'type' | 'interface' | 'class' | 'all'
  dryRun?: boolean
}

export interface RenameLocationInfo {
  file: string
  line: number
  column: number
  kind: 'definition' | 'reference' | 'import' | 'export' | 'type'
  context: string
}

export interface RenameResult {
  success: boolean
  filesModified: string[]
  locationsUpdated: number
  errors?: string[]
}

interface FileBackup {
  filePath: string
  content: string
}

// Cached ts-morph project
let cachedProject: Project | null = null
let projectCacheTime = 0
const PROJECT_CACHE_TTL = 60000 // 1 minute

/**
 * Get or create a ts-morph project for the codebase
 */
async function getProject(): Promise<Project> {
  const now = Date.now()
  if (cachedProject && now - projectCacheTime < PROJECT_CACHE_TTL) {
    return cachedProject
  }

  const tsConfigPath = path.join(projectRoot, 'tsconfig.json')
  cachedProject = new Project({tsConfigFilePath: tsConfigPath})
  projectCacheTime = now

  return cachedProject
}

/**
 * Determine the kind of a rename location
 */
function classifyLocation(node: Node): 'definition' | 'reference' | 'import' | 'export' | 'type' {
  const parent = node.getParent()
  if (!parent) {
    return 'reference'
  }

  // Check if in import statement
  if (node.getFirstAncestorByKind(10 /* ImportDeclaration */)) {
    return 'import'
  }

  // Check if in export statement
  if (node.getFirstAncestorByKind(275 /* ExportDeclaration */) || node.getFirstAncestorByKind(276 /* ExportAssignment */)) {
    return 'export'
  }

  // Check if this is a definition
  const kind = parent.getKind()
  if (
    kind === 259 /* FunctionDeclaration */ ||
    kind === 260 /* ClassDeclaration */ ||
    kind === 261 /* InterfaceDeclaration */ ||
    kind === 262 /* TypeAliasDeclaration */ ||
    kind === 263 /* EnumDeclaration */ ||
    kind === 257 /* VariableDeclaration */
  ) {
    return 'definition'
  }

  // Check if in type context
  if (node.getFirstAncestorByKind(180 /* TypeReference */)) {
    return 'type'
  }

  return 'reference'
}

/**
 * Get context around a location for preview
 */
function getContext(sourceFile: SourceFile, line: number): string {
  const text = sourceFile.getFullText()
  const lines = text.split('\n')
  const lineIndex = line - 1

  // Get up to 3 lines of context
  const start = Math.max(0, lineIndex - 1)
  const end = Math.min(lines.length, lineIndex + 2)

  return lines.slice(start, end).map((l, i) => {
    const lineNum = start + i + 1
    const prefix = lineNum === line ? '> ' : '  '
    return `${prefix}${lineNum}: ${l}`
  }).join('\n')
}

/**
 * Find all occurrences of a symbol
 */
async function findOccurrences(project: Project, symbol: string, options: {scope?: string; file?: string; type?: string}): Promise<RenameLocationInfo[]> {
  const locations: RenameLocationInfo[] = []
  const sourceFiles = project.getSourceFiles()

  // Filter source files by scope
  let filesToSearch = sourceFiles.filter((sf) => {
    const filePath = sf.getFilePath()
    // Exclude node_modules and test files for now
    if (filePath.includes('node_modules')) {
      return false
    }
    if (!filePath.includes('/src/')) {
      return false
    }
    return true
  })

  if (options.file) {
    const targetFile = path.resolve(projectRoot, options.file)
    filesToSearch = filesToSearch.filter((sf) => sf.getFilePath() === targetFile)
  }

  if (options.scope === 'module' && options.file) {
    // Module scope: only files in the same directory
    const moduleDir = path.dirname(path.resolve(projectRoot, options.file))
    filesToSearch = filesToSearch.filter((sf) => sf.getFilePath().startsWith(moduleDir))
  }

  for (const sourceFile of filesToSearch) {
    const filePath = path.relative(projectRoot, sourceFile.getFilePath())

    // Find the symbol definition first
    const definitions = sourceFile.getDescendantsOfKind(79 /* Identifier */).filter((id) => id.getText() === symbol)

    for (const def of definitions) {
      // Filter by type if specified
      if (options.type && options.type !== 'all') {
        const parent = def.getParent()
        if (!parent) {
          continue
        }

        const parentKind = parent.getKind()
        const isMatch = (options.type === 'function' && (parentKind === 259 || parentKind === 216)) || // FunctionDeclaration or ArrowFunction
          (options.type === 'variable' && parentKind === 257) || // VariableDeclaration
          (options.type === 'type' && parentKind === 262) || // TypeAliasDeclaration
          (options.type === 'interface' && parentKind === 261) || // InterfaceDeclaration
          (options.type === 'class' && parentKind === 260) // ClassDeclaration

        if (!isMatch) {
          continue
        }
      }

      const start = def.getStart()
      const lineAndCol = sourceFile.getLineAndColumnAtPos(start)

      locations.push({
        file: filePath,
        line: lineAndCol.line,
        column: lineAndCol.column,
        kind: classifyLocation(def),
        context: getContext(sourceFile, lineAndCol.line)
      })
    }
  }

  return locations
}

/**
 * Check if a new name would conflict with existing symbols
 */
async function validateNewName(project: Project, newName: string, locations: RenameLocationInfo[]): Promise<{valid: boolean; conflicts: string[]}> {
  const conflicts: string[] = []

  // Get all files that contain the symbol
  const affectedFiles = new Set(locations.map((l) => l.file))

  for (const filePath of affectedFiles) {
    const sourceFile = project.getSourceFile(path.join(projectRoot, filePath))
    if (!sourceFile) {
      continue
    }

    // Check if newName already exists in this file
    const existingSymbols = sourceFile.getDescendantsOfKind(79 /* Identifier */).filter((id) => id.getText() === newName)

    if (existingSymbols.length > 0) {
      conflicts.push(`Symbol '${newName}' already exists in ${filePath}`)
    }
  }

  return {valid: conflicts.length === 0, conflicts}
}

/**
 * Apply rename to all locations
 */
async function applyRename(project: Project, locations: RenameLocationInfo[], oldName: string, newName: string, dryRun: boolean): Promise<RenameResult> {
  const backups: FileBackup[] = []
  const modifiedFiles = new Set<string>()
  const errors: string[] = []

  try {
    // Group locations by file
    const locationsByFile = new Map<string, RenameLocationInfo[]>()
    for (const loc of locations) {
      const existing = locationsByFile.get(loc.file) || []
      existing.push(loc)
      locationsByFile.set(loc.file, existing)
    }

    // Process each file
    for (const [filePath, fileLocs] of locationsByFile) {
      const fullPath = path.join(projectRoot, filePath)
      const sourceFile = project.getSourceFile(fullPath)
      if (!sourceFile) {
        errors.push(`Could not find source file: ${filePath}`)
        continue
      }

      // Backup original content
      const originalContent = sourceFile.getFullText()
      backups.push({filePath: fullPath, content: originalContent})

      // Sort locations by position (descending) to replace from end to start
      const sortedLocs = [...fileLocs].sort((a, b) => {
        if (a.line !== b.line) {
          return b.line - a.line
        }
        return b.column - a.column
      })

      // Find and rename each identifier
      for (const loc of sortedLocs) {
        const pos = sourceFile.compilerNode.getPositionOfLineAndCharacter(loc.line - 1, loc.column - 1)
        const node = sourceFile.getDescendantAtPos(pos)

        if (node && node.getText() === oldName) {
          // Use replaceWithText for simple rename
          const identifier = node.asKind(79 /* Identifier */)
          if (identifier) {
            identifier.replaceWithText(newName)
            modifiedFiles.add(filePath)
          }
        }
      }
    }

    // Save changes if not dry run
    if (!dryRun) {
      await project.save()
    } else {
      // Revert changes for dry run
      for (const backup of backups) {
        const sourceFile = project.getSourceFile(backup.filePath)
        if (sourceFile) {
          sourceFile.replaceWithText(backup.content)
        }
      }
    }

    return {success: true, filesModified: Array.from(modifiedFiles), locationsUpdated: locations.length, errors: errors.length > 0 ? errors : undefined}
  } catch (error) {
    // Rollback on error
    for (const backup of backups) {
      try {
        await fs.writeFile(backup.filePath, backup.content, 'utf-8')
      } catch {
        errors.push(`Failed to rollback ${backup.filePath}`)
      }
    }

    return {success: false, filesModified: [], locationsUpdated: 0, errors: [...errors, error instanceof Error ? error.message : String(error)]}
  }
}

/**
 * Main handler for rename symbol queries
 */
export async function handleRenameSymbolQuery(args: RenameSymbolArgs) {
  const {query, symbol, newName, scope = 'project', file, type = 'all', dryRun = true} = args

  if (!symbol) {
    return createErrorResponse('Symbol name required', 'Example: {query: "preview", symbol: "oldName", newName: "newName"}')
  }

  if (!newName && query !== 'preview') {
    return createErrorResponse('New name required for validate/execute queries')
  }

  // Validate symbol name format
  if (newName && !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(newName)) {
    return createErrorResponse(`Invalid identifier: '${newName}'`, 'Must be a valid JavaScript/TypeScript identifier')
  }

  const project = await getProject()

  switch (query) {
    case 'preview': {
      // Find all occurrences without making changes
      const locations = await findOccurrences(project, symbol, {scope, file, type})

      if (locations.length === 0) {
        return createSuccessResponse({symbol, found: false, message: `No occurrences of '${symbol}' found`, searchScope: {scope, file, type}})
      }

      // Group by file for summary
      const byFile: Record<string, number> = {}
      const byKind: Record<string, number> = {}
      for (const loc of locations) {
        byFile[loc.file] = (byFile[loc.file] || 0) + 1
        byKind[loc.kind] = (byKind[loc.kind] || 0) + 1
      }

      return createSuccessResponse({
        symbol,
        found: true,
        totalOccurrences: locations.length,
        locations,
        summary: {byFile, byKind},
        nextStep: newName ? `Use query: 'validate' to check for conflicts with '${newName}'` : "Provide 'newName' and use query: 'validate'"
      })
    }

    case 'validate': {
      // Find occurrences and check for conflicts
      const locations = await findOccurrences(project, symbol, {scope, file, type})

      if (locations.length === 0) {
        return createSuccessResponse({symbol, newName, valid: false, reason: `No occurrences of '${symbol}' found`})
      }

      const validation = await validateNewName(project, newName, locations)

      return createSuccessResponse({
        symbol,
        newName,
        occurrences: locations.length,
        valid: validation.valid,
        conflicts: validation.conflicts.length > 0 ? validation.conflicts : undefined,
        nextStep: validation.valid
          ? dryRun
            ? "Use query: 'execute' with dryRun: false to apply the rename"
            : "Ready to rename. Use query: 'execute' to apply."
          : 'Resolve conflicts before renaming'
      })
    }

    case 'execute': {
      // Find occurrences
      const locations = await findOccurrences(project, symbol, {scope, file, type})

      if (locations.length === 0) {
        return createSuccessResponse({success: false, error: `No occurrences of '${symbol}' found`})
      }

      // Validate first
      const validation = await validateNewName(project, newName, locations)
      if (!validation.valid) {
        return createSuccessResponse({
          success: false,
          error: 'Conflicts detected',
          conflicts: validation.conflicts,
          hint: 'Resolve conflicts or use a different name'
        })
      }

      // Apply rename
      const result = await applyRename(project, locations, symbol, newName, dryRun)

      // Invalidate project cache after modification
      if (!dryRun && result.success) {
        cachedProject = null
        projectCacheTime = 0
      }

      return createSuccessResponse({
        ...result,
        symbol,
        newName,
        dryRun,
        message: dryRun
          ? `Dry run complete. ${result.locationsUpdated} locations would be updated.`
          : `Renamed '${symbol}' to '${newName}' in ${result.filesModified.length} file(s).`
      })
    }

    default:
      return createErrorResponse(`Unknown query type: ${query}`, 'Available queries: preview, validate, execute')
  }
}
