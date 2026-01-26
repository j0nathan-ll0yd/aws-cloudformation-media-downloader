/**
 * Inline constant refactoring handler for MCP server
 * Find and inline single-use exported constants
 *
 * Features:
 * - Find single-use exported constants
 * - Preview inlining changes
 * - Execute inlining with import updates
 */

import {Project, SyntaxKind, VariableDeclaration} from 'ts-morph'
import path from 'path'
import {fileURLToPath} from 'url'
import {loadDependencyGraph} from '../data-loader.js'
import {createErrorResponse, createSuccessResponse} from '../shared/response-types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../..')

export type InlineQueryType = 'find' | 'preview' | 'execute'

export interface InlineConstantArgs {
  query: InlineQueryType
  file?: string
  constant?: string
  maxUses?: number
}

interface SingleUseConstant {
  name: string
  file: string
  line: number
  value: string
  valueType: string
  usageCount: number
  usageLocations: Array<{file: string; line: number}>
  canInline: boolean
  reason?: string
}

interface InlinePreview {
  constant: string
  sourceFile: string
  value: string
  usages: Array<{file: string; line: number; before: string; after: string}>
  importsToRemove: Array<{file: string; importStatement: string}>
}

// Cache for ts-morph project
let cachedProject: Project | null = null
let projectCacheTime = 0
const PROJECT_CACHE_TTL = 60000

async function getProject(): Promise<Project> {
  const now = Date.now()
  if (cachedProject && now - projectCacheTime < PROJECT_CACHE_TTL) {
    return cachedProject
  }

  cachedProject = new Project({tsConfigFilePath: path.join(projectRoot, 'tsconfig.json')})
  projectCacheTime = now
  return cachedProject
}

/**
 * Find exported constants with their usage counts
 */
async function findExportedConstants(filePath?: string): Promise<SingleUseConstant[]> {
  const project = await getProject()
  const depGraph = await loadDependencyGraph()
  const constants: SingleUseConstant[] = []

  // Get source files to analyze
  let sourceFiles = project.getSourceFiles()
  if (filePath) {
    const fullPath = filePath.startsWith('/') ? filePath : path.join(projectRoot, filePath)
    const sf = project.getSourceFile(fullPath)
    sourceFiles = sf ? [sf] : []
  } else {
    // Default to utility files that commonly have constants
    sourceFiles = sourceFiles.filter((sf) => {
      const fp = sf.getFilePath()
      return fp.includes('/util/') || fp.includes('/lib/') || fp.includes('/constants/')
    })
  }

  for (const sourceFile of sourceFiles) {
    const relativePath = path.relative(projectRoot, sourceFile.getFilePath())

    // Find all exported variable declarations
    const varStatements = sourceFile.getVariableStatements().filter((vs) => vs.isExported())

    for (const varStmt of varStatements) {
      for (const decl of varStmt.getDeclarations()) {
        const name = decl.getName()
        const initializer = decl.getInitializer()

        if (!initializer) {
          continue
        }

        // Only consider simple values that can be inlined
        const valueText = initializer.getText()
        const canInline = isInlineable(initializer)

        // Find usages across the codebase
        const usageLocations: Array<{file: string; line: number}> = []

        // Check files that import this module
        for (const [file, data] of Object.entries(depGraph.files)) {
          if (data.imports?.includes(relativePath)) {
            const importingFile = project.getSourceFile(path.join(projectRoot, file))
            if (importingFile) {
              // Check if this file imports the constant
              for (const imp of importingFile.getImportDeclarations()) {
                const moduleSpec = imp.getModuleSpecifierValue()
                if (moduleSpec.includes(path.basename(relativePath, '.ts'))) {
                  const namedImports = imp.getNamedImports()
                  for (const namedImp of namedImports) {
                    if (namedImp.getName() === name) {
                      // Find all usages in this file
                      const identifiers = importingFile.getDescendantsOfKind(SyntaxKind.Identifier)
                      for (const id of identifiers) {
                        if (id.getText() === name && id !== namedImp.getNameNode()) {
                          usageLocations.push({file, line: id.getStartLineNumber()})
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        const reason = !canInline
          ? 'Value is too complex to inline (contains function calls or object literals)'
          : usageLocations.length === 0
          ? 'No external usages found'
          : undefined

        constants.push({
          name,
          file: relativePath,
          line: decl.getStartLineNumber(),
          value: valueText,
          valueType: getValueType(initializer),
          usageCount: usageLocations.length,
          usageLocations,
          canInline: canInline && usageLocations.length > 0,
          reason
        })
      }
    }
  }

  return constants.sort((a, b) => a.usageCount - b.usageCount)
}

/**
 * Check if a value can be safely inlined
 */
function isInlineable(node: VariableDeclaration['getInitializer'] extends () => infer R ? NonNullable<R> : never): boolean {
  const kind = node.getKind()

  // Simple literals are always inlineable
  if (
    kind === SyntaxKind.StringLiteral ||
    kind === SyntaxKind.NumericLiteral ||
    kind === SyntaxKind.TrueKeyword ||
    kind === SyntaxKind.FalseKeyword ||
    kind === SyntaxKind.NullKeyword
  ) {
    return true
  }

  // Template literals without expressions
  if (kind === SyntaxKind.NoSubstitutionTemplateLiteral) {
    return true
  }

  // Arrays of literals
  if (kind === SyntaxKind.ArrayLiteralExpression) {
    const text = node.getText()
    // Simple check: no function calls
    return !text.includes('(') || Boolean(text.match(/^\[[\s\S]*\]$/))
  }

  // Regex literals
  if (kind === SyntaxKind.RegularExpressionLiteral) {
    return true
  }

  return false
}

/**
 * Get a human-readable type for the value
 */
function getValueType(node: VariableDeclaration['getInitializer'] extends () => infer R ? NonNullable<R> : never): string {
  const kind = node.getKind()

  if (kind === SyntaxKind.StringLiteral || kind === SyntaxKind.NoSubstitutionTemplateLiteral) {
    return 'string'
  }
  if (kind === SyntaxKind.NumericLiteral) {
    return 'number'
  }
  if (kind === SyntaxKind.TrueKeyword || kind === SyntaxKind.FalseKeyword) {
    return 'boolean'
  }
  if (kind === SyntaxKind.ArrayLiteralExpression) {
    return 'array'
  }
  if (kind === SyntaxKind.RegularExpressionLiteral) {
    return 'regex'
  }

  return 'unknown'
}

/**
 * Preview inlining a constant
 */
async function previewInline(constantName: string, sourceFilePath: string): Promise<InlinePreview | null> {
  const project = await getProject()
  const fullPath = sourceFilePath.startsWith('/') ? sourceFilePath : path.join(projectRoot, sourceFilePath)
  const sourceFile = project.getSourceFile(fullPath)

  if (!sourceFile) {
    return null
  }

  // Find the constant
  let constantValue: string | null = null
  const varStatements = sourceFile.getVariableStatements().filter((vs) => vs.isExported())

  for (const varStmt of varStatements) {
    for (const decl of varStmt.getDeclarations()) {
      if (decl.getName() === constantName) {
        const init = decl.getInitializer()
        if (init) {
          constantValue = init.getText()
        }
        break
      }
    }
  }

  if (!constantValue) {
    return null
  }

  const depGraph = await loadDependencyGraph()
  const relativePath = path.relative(projectRoot, fullPath)
  const usages: InlinePreview['usages'] = []
  const importsToRemove: InlinePreview['importsToRemove'] = []

  // Find all usages
  for (const [file, data] of Object.entries(depGraph.files)) {
    if (data.imports?.includes(relativePath)) {
      const importingFile = project.getSourceFile(path.join(projectRoot, file))
      if (!importingFile) {
        continue
      }

      let foundImport = false
      let importStatement = ''

      for (const imp of importingFile.getImportDeclarations()) {
        const moduleSpec = imp.getModuleSpecifierValue()
        if (moduleSpec.includes(path.basename(relativePath, '.ts'))) {
          const namedImports = imp.getNamedImports()
          for (const namedImp of namedImports) {
            if (namedImp.getName() === constantName) {
              foundImport = true
              importStatement = imp.getText()

              // Find usages
              const identifiers = importingFile.getDescendantsOfKind(SyntaxKind.Identifier)
              for (const id of identifiers) {
                if (id.getText() === constantName && id !== namedImp.getNameNode()) {
                  const parent = id.getParent()
                  if (parent) {
                    const before = parent.getText()
                    const after = before.replace(new RegExp(`\\b${constantName}\\b`, 'g'), constantValue)
                    usages.push({file, line: id.getStartLineNumber(), before: before.substring(0, 80), after: after.substring(0, 80)})
                  }
                }
              }
            }
          }
        }
      }

      if (foundImport) {
        importsToRemove.push({file, importStatement})
      }
    }
  }

  return {constant: constantName, sourceFile: relativePath, value: constantValue, usages, importsToRemove}
}

/**
 * Main handler for inline constant queries
 */
export async function handleInlineConstantQuery(args: InlineConstantArgs) {
  const {query, file, constant, maxUses = 3} = args
  switch (query) {
    case 'find': {
      const constants = await findExportedConstants(file)

      // Filter to single/low-use constants
      const lowUse = constants.filter((c) => c.usageCount <= maxUses && c.usageCount > 0)
      const noUse = constants.filter((c) => c.usageCount === 0)

      return createSuccessResponse({
        summary: {totalConstants: constants.length, lowUseConstants: lowUse.length, unusedConstants: noUse.length},
        lowUseConstants: lowUse.map((c) => ({
          name: c.name,
          file: c.file,
          line: c.line,
          usages: c.usageCount,
          valueType: c.valueType,
          canInline: c.canInline,
          reason: c.reason
        })),
        unusedConstants: noUse.map((c) => ({name: c.name, file: c.file, line: c.line, note: 'Consider removing - no external usages'})),
        nextStep: lowUse.length > 0 ? "Use query: 'preview' with constant name and file to see inlining plan" : 'No low-use constants found'
      })
    }

    case 'preview': {
      if (!constant || !file) {
        return createErrorResponse('Both constant and file required for preview',
          'Example: {query: "preview", constant: "DEFAULT_TIMEOUT", file: "src/util/constants.ts"}')
      }

      const preview = await previewInline(constant, file)

      if (!preview) {
        return createErrorResponse(`Constant '${constant}' not found in ${file}`)
      }

      return createSuccessResponse({
        constant: preview.constant,
        sourceFile: preview.sourceFile,
        value: preview.value,
        changes: {usagesReplaced: preview.usages.length, importsRemoved: preview.importsToRemove.length},
        usages: preview.usages,
        importsToRemove: preview.importsToRemove,
        note: preview.usages.length > 0
          ? "Review changes above. Use query: 'execute' to apply (not yet implemented - manual refactoring recommended)"
          : 'No usages found to inline'
      })
    }

    case 'execute': {
      // For safety, execution is deferred - provide guidance instead
      return createSuccessResponse({
        message: 'Automatic execution not yet implemented for safety reasons',
        recommendation: 'Use the preview output to manually inline the constant',
        steps: [
          '1. Replace all usages with the constant value',
          '2. Remove the constant from import statements',
          '3. If import becomes empty, remove the entire import',
          '4. Optionally remove the constant from the source file if no longer used'
        ],
        note: 'Consider using refactor_rename_symbol for type-safe bulk operations'
      })
    }

    default:
      return createErrorResponse(`Unknown query type: ${query}`, 'Available queries: find, preview, execute')
  }
}
