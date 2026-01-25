/**
 * Semantic diff handler for MCP server
 * Provides structural code change analysis beyond line-level diffs
 *
 * Features:
 * - Detects function/interface/type changes
 * - Classifies breaking vs non-breaking changes
 * - Maps changes to affected Lambdas and tests
 */

import {Project, SourceFile} from 'ts-morph'
import {fileExistsAtRef, getChangedFiles, getFileAtRef} from '../shared/git-utils.js'
import {loadDependencyGraph} from '../data-loader.js'
import {createErrorResponse} from '../shared/response-types.js'

export type SemanticDiffQueryType = 'changes' | 'breaking' | 'impact'

export interface SemanticDiffArgs {
  query: SemanticDiffQueryType
  baseRef?: string
  headRef?: string
  scope?: 'all' | 'src' | 'entities' | 'lambdas'
}

export type ChangeType =
  | 'function_added'
  | 'function_removed'
  | 'function_signature_changed'
  | 'interface_added'
  | 'interface_removed'
  | 'interface_modified'
  | 'type_alias_added'
  | 'type_alias_removed'
  | 'type_alias_changed'
  | 'export_added'
  | 'export_removed'
  | 'class_added'
  | 'class_removed'
  | 'class_modified'
  | 'parameter_added'
  | 'parameter_removed'
  | 'return_type_changed'

export interface StructuralChange {
  file: string
  type: ChangeType
  symbol: string
  detail: string
  breaking: boolean
  severity: 'info' | 'warning' | 'error'
  line?: number
}

interface ExportedSymbol {
  name: string
  kind: 'function' | 'interface' | 'type' | 'class' | 'variable' | 'enum'
  signature?: string
  members?: string[]
  parameters?: string[]
  returnType?: string
}

/**
 * Extract exported symbols from a source file
 */
function extractExportedSymbols(sourceFile: SourceFile): Map<string, ExportedSymbol> {
  const symbols = new Map<string, ExportedSymbol>()

  // Functions
  for (const fn of sourceFile.getFunctions()) {
    if (fn.isExported()) {
      const name = fn.getName() || 'anonymous'
      symbols.set(name, {
        name,
        kind: 'function',
        signature: fn.getSignature()?.getDeclaration().getText() || fn.getText().split('{')[0].trim(),
        parameters: fn.getParameters().map((p) => `${p.getName()}: ${p.getType().getText()}`),
        returnType: fn.getReturnType().getText()
      })
    }
  }

  // Interfaces
  for (const iface of sourceFile.getInterfaces()) {
    if (iface.isExported()) {
      const name = iface.getName()
      symbols.set(name, {name, kind: 'interface', members: iface.getMembers().map((m) => m.getText())})
    }
  }

  // Type aliases
  for (const typeAlias of sourceFile.getTypeAliases()) {
    if (typeAlias.isExported()) {
      const name = typeAlias.getName()
      symbols.set(name, {name, kind: 'type', signature: typeAlias.getText()})
    }
  }

  // Classes
  for (const cls of sourceFile.getClasses()) {
    if (cls.isExported()) {
      const name = cls.getName() || 'anonymous'
      symbols.set(name, {name, kind: 'class', members: cls.getMembers().map((m) => m.getText().split('{')[0].trim())})
    }
  }

  // Exported variables/constants
  for (const varDecl of sourceFile.getVariableDeclarations()) {
    const varStmt = varDecl.getVariableStatement()
    if (varStmt?.isExported()) {
      const name = varDecl.getName()
      symbols.set(name, {name, kind: 'variable', signature: varDecl.getType().getText()})
    }
  }

  // Enums
  for (const enumDecl of sourceFile.getEnums()) {
    if (enumDecl.isExported()) {
      const name = enumDecl.getName()
      symbols.set(name, {name, kind: 'enum', members: enumDecl.getMembers().map((m) => m.getName())})
    }
  }

  return symbols
}

/**
 * Compare two sets of exported symbols and identify changes
 */
function compareSymbols(baseSymbols: Map<string, ExportedSymbol>, headSymbols: Map<string, ExportedSymbol>, filePath: string): StructuralChange[] {
  const changes: StructuralChange[] = []

  // Check for removed symbols (breaking)
  for (const [name, baseSymbol] of baseSymbols) {
    if (!headSymbols.has(name)) {
      const changeType: ChangeType = baseSymbol.kind === 'function'
        ? 'function_removed'
        : baseSymbol.kind === 'interface'
        ? 'interface_removed'
        : baseSymbol.kind === 'type'
        ? 'type_alias_removed'
        : baseSymbol.kind === 'class'
        ? 'class_removed'
        : 'export_removed'

      changes.push({
        file: filePath,
        type: changeType,
        symbol: name,
        detail: `Removed exported ${baseSymbol.kind} '${name}'`,
        breaking: true,
        severity: 'error'
      })
    }
  }

  // Check for added symbols (non-breaking)
  for (const [name, headSymbol] of headSymbols) {
    if (!baseSymbols.has(name)) {
      const changeType: ChangeType = headSymbol.kind === 'function'
        ? 'function_added'
        : headSymbol.kind === 'interface'
        ? 'interface_added'
        : headSymbol.kind === 'type'
        ? 'type_alias_added'
        : headSymbol.kind === 'class'
        ? 'class_added'
        : 'export_added'

      changes.push({
        file: filePath,
        type: changeType,
        symbol: name,
        detail: `Added new exported ${headSymbol.kind} '${name}'`,
        breaking: false,
        severity: 'info'
      })
    }
  }

  // Check for modified symbols
  for (const [name, baseSymbol] of baseSymbols) {
    const headSymbol = headSymbols.get(name)
    if (!headSymbol) {
      continue
    }

    // Compare based on kind
    if (baseSymbol.kind === 'function' && headSymbol.kind === 'function') {
      // Check parameter changes
      const baseParams = baseSymbol.parameters || []
      const headParams = headSymbol.parameters || []

      // Added required parameters is breaking
      if (headParams.length > baseParams.length) {
        const newParams = headParams.slice(baseParams.length)
        const hasRequiredNew = newParams.some((p) => !p.includes('?'))
        if (hasRequiredNew) {
          changes.push({
            file: filePath,
            type: 'parameter_added',
            symbol: name,
            detail: `Added required parameter(s) to '${name}': ${newParams.join(', ')}`,
            breaking: true,
            severity: 'error'
          })
        } else {
          changes.push({
            file: filePath,
            type: 'parameter_added',
            symbol: name,
            detail: `Added optional parameter(s) to '${name}': ${newParams.join(', ')}`,
            breaking: false,
            severity: 'info'
          })
        }
      }

      // Removed parameters is breaking
      if (headParams.length < baseParams.length) {
        const removedParams = baseParams.slice(headParams.length)
        changes.push({
          file: filePath,
          type: 'parameter_removed',
          symbol: name,
          detail: `Removed parameter(s) from '${name}': ${removedParams.join(', ')}`,
          breaking: true,
          severity: 'error'
        })
      }

      // Return type change
      if (baseSymbol.returnType !== headSymbol.returnType) {
        // Narrowing return type is non-breaking, widening is breaking
        const isWidening = Boolean(headSymbol.returnType?.includes('|') && !baseSymbol.returnType?.includes('|'))
        changes.push({
          file: filePath,
          type: 'return_type_changed',
          symbol: name,
          detail: `Return type of '${name}' changed from '${baseSymbol.returnType}' to '${headSymbol.returnType}'`,
          breaking: isWidening,
          severity: isWidening ? 'error' : 'warning'
        })
      }

      // Signature change (catch-all for other changes)
      if (baseSymbol.signature !== headSymbol.signature && changes.filter((c) => c.symbol === name).length === 0) {
        changes.push({
          file: filePath,
          type: 'function_signature_changed',
          symbol: name,
          detail: `Signature of '${name}' changed`,
          breaking: true,
          severity: 'warning'
        })
      }
    }

    if (baseSymbol.kind === 'interface' && headSymbol.kind === 'interface') {
      const baseMembers = new Set(baseSymbol.members || [])
      const headMembers = new Set(headSymbol.members || [])

      // Check for removed members (breaking)
      for (const member of baseMembers) {
        if (!headMembers.has(member)) {
          changes.push({
            file: filePath,
            type: 'interface_modified',
            symbol: name,
            detail: `Removed member from interface '${name}': ${member.split('\n')[0]}`,
            breaking: true,
            severity: 'error'
          })
        }
      }

      // Check for added required members (breaking)
      for (const member of headMembers) {
        if (!baseMembers.has(member)) {
          const isOptional = member.includes('?:')
          changes.push({
            file: filePath,
            type: 'interface_modified',
            symbol: name,
            detail: `Added ${isOptional ? 'optional' : 'required'} member to interface '${name}': ${member.split('\n')[0]}`,
            breaking: !isOptional,
            severity: isOptional ? 'info' : 'error'
          })
        }
      }
    }

    if (baseSymbol.kind === 'type' && headSymbol.kind === 'type') {
      if (baseSymbol.signature !== headSymbol.signature) {
        changes.push({
          file: filePath,
          type: 'type_alias_changed',
          symbol: name,
          detail: `Type alias '${name}' definition changed`,
          breaking: true,
          severity: 'warning'
        })
      }
    }
  }

  return changes
}

/**
 * Parse source code at a specific git ref
 */
function parseAtRef(content: string, filePath: string): SourceFile | null {
  if (!content) {
    return null
  }
  try {
    const project = new Project({useInMemoryFileSystem: true, compilerOptions: {strict: true}})
    return project.createSourceFile(filePath, content)
  } catch {
    return null
  }
}

/**
 * Filter files by scope
 */
function filterByScope(files: string[], scope: string): string[] {
  switch (scope) {
    case 'src':
      return files.filter((f) => f.startsWith('src/') && !f.includes('.test.'))
    case 'entities':
      return files.filter((f) => f.includes('/entities/'))
    case 'lambdas':
      return files.filter((f) => f.includes('/lambdas/'))
    default:
      return files
  }
}

/**
 * Extract Lambda name from file path
 */
function extractLambdaName(filePath: string): string | null {
  const match = filePath.match(/src\/lambdas\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Main handler for semantic diff queries
 */
export async function handleSemanticDiffQuery(args: SemanticDiffArgs) {
  const {query, baseRef = 'HEAD~1', headRef = 'HEAD', scope = 'all'} = args

  // Get changed files
  let changedFiles: string[]
  try {
    changedFiles = getChangedFiles(baseRef, headRef)
  } catch (error) {
    return createErrorResponse(`Failed to get changed files: ${error instanceof Error ? error.message : String(error)}`,
      'Ensure both refs exist. Use HEAD~1 for last commit, or a branch name.')
  }

  // Filter by scope
  changedFiles = filterByScope(changedFiles, scope)

  if (changedFiles.length === 0) {
    return {baseRef, headRef, scope, message: 'No TypeScript files changed between refs', changedFiles: []}
  }

  // Analyze each changed file
  const allChanges: StructuralChange[] = []

  for (const filePath of changedFiles) {
    const baseExists = fileExistsAtRef(filePath, baseRef)
    const headExists = fileExistsAtRef(filePath, headRef)

    if (!baseExists && headExists) {
      // New file - all exports are additions
      const headContent = getFileAtRef(filePath, headRef)
      const headFile = parseAtRef(headContent, filePath)
      if (headFile) {
        const symbols = extractExportedSymbols(headFile)
        for (const [name, symbol] of symbols) {
          allChanges.push({
            file: filePath,
            type: symbol.kind === 'function' ? 'function_added' : symbol.kind === 'interface' ? 'interface_added' : 'export_added',
            symbol: name,
            detail: `New file with exported ${symbol.kind} '${name}'`,
            breaking: false,
            severity: 'info'
          })
        }
      }
    } else if (baseExists && !headExists) {
      // Deleted file - all exports are removals
      const baseContent = getFileAtRef(filePath, baseRef)
      const baseFile = parseAtRef(baseContent, filePath)
      if (baseFile) {
        const symbols = extractExportedSymbols(baseFile)
        for (const [name, symbol] of symbols) {
          allChanges.push({
            file: filePath,
            type: symbol.kind === 'function' ? 'function_removed' : symbol.kind === 'interface' ? 'interface_removed' : 'export_removed',
            symbol: name,
            detail: `Deleted file contained exported ${symbol.kind} '${name}'`,
            breaking: true,
            severity: 'error'
          })
        }
      }
    } else if (baseExists && headExists) {
      // Modified file - compare exports
      const baseContent = getFileAtRef(filePath, baseRef)
      const headContent = getFileAtRef(filePath, headRef)

      const baseFile = parseAtRef(baseContent, filePath)
      const headFile = parseAtRef(headContent, filePath)

      if (baseFile && headFile) {
        const baseSymbols = extractExportedSymbols(baseFile)
        const headSymbols = extractExportedSymbols(headFile)
        const changes = compareSymbols(baseSymbols, headSymbols, filePath)
        allChanges.push(...changes)
      }
    }
  }

  switch (query) {
    case 'changes': {
      // Return all structural changes
      return {
        baseRef,
        headRef,
        scope,
        totalFiles: changedFiles.length,
        totalChanges: allChanges.length,
        changes: allChanges,
        summary: {
          breaking: allChanges.filter((c) => c.breaking).length,
          nonBreaking: allChanges.filter((c) => !c.breaking).length,
          byType: allChanges.reduce((acc, c) => {
            acc[c.type] = (acc[c.type] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }
      }
    }

    case 'breaking': {
      // Return only breaking changes
      const breakingChanges = allChanges.filter((c) => c.breaking)

      return {
        baseRef,
        headRef,
        scope,
        hasBreakingChanges: breakingChanges.length > 0,
        breakingCount: breakingChanges.length,
        breakingChanges,
        recommendation: breakingChanges.length > 0
          ? 'BREAKING CHANGES DETECTED: Review affected consumers before merging'
          : 'No breaking changes detected'
      }
    }

    case 'impact': {
      // Map changes to affected Lambdas and tests
      const depGraph = await loadDependencyGraph()

      // Find affected Lambdas
      const affectedLambdas = new Set<string>()
      const affectedTests: string[] = []

      for (const change of allChanges) {
        const lambdaName = extractLambdaName(change.file)
        if (lambdaName) {
          affectedLambdas.add(lambdaName)
        }

        // Find dependents of changed file
        const normalizedFile = change.file.startsWith('src/') ? change.file : `src/${change.file}`
        for (const [file, data] of Object.entries(depGraph.files)) {
          if (data.imports?.includes(normalizedFile)) {
            const depLambda = extractLambdaName(file)
            if (depLambda) {
              affectedLambdas.add(depLambda)
            }
            if (file.includes('.test.') || file.includes('/test/')) {
              affectedTests.push(file)
            }
          }
        }
      }

      // Deduce test files for affected Lambdas
      const testsToRun = Array.from(affectedLambdas).map((name) => `src/lambdas/${name}/test/`)

      return {
        baseRef,
        headRef,
        scope,
        changedFiles,
        changes: allChanges,
        impact: {
          affectedLambdas: Array.from(affectedLambdas).sort(),
          lambdaCount: affectedLambdas.size,
          testsToRun: [...new Set([...testsToRun, ...affectedTests])],
          hasBreakingChanges: allChanges.some((c) => c.breaking)
        },
        testCommand: affectedLambdas.size > 0 ? `pnpm test -- --testPathPattern="${Array.from(affectedLambdas).join('|')}"` : 'pnpm test',
        recommendation: allChanges.some((c) => c.breaking)
          ? `BREAKING: Run full test suite for ${affectedLambdas.size} affected Lambda(s)`
          : `Run targeted tests for ${affectedLambdas.size} affected Lambda(s)`
      }
    }

    default:
      return createErrorResponse(`Unknown query type: ${query}`, 'Available queries: changes, breaking, impact')
  }
}
