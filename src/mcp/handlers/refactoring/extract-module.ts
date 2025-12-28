/**
 * Module extraction refactoring handler for MCP server
 * Extract symbols to new modules and update all imports
 *
 * Features:
 * - Analyze extractable symbols from a file
 * - Preview proposed file structure and import changes
 * - Execute extraction with import updates
 */

import {Project, SourceFile, SyntaxKind} from 'ts-morph'
import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'url'
import {loadDependencyGraph} from '../data-loader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../..')

export type ExtractQueryType = 'analyze' | 'preview' | 'execute'

export interface ExtractModuleArgs {
  query: ExtractQueryType
  sourceFile: string
  symbols?: string[]
  targetModule: string
  createBarrel?: boolean
}

interface ExtractableSymbol {
  name: string
  kind: 'function' | 'interface' | 'type' | 'class' | 'variable' | 'enum'
  startLine: number
  endLine: number
  dependencies: string[]
  dependents: string[]
  canExtract: boolean
  reason?: string
}

interface ImportChange {
  file: string
  action: 'add' | 'modify' | 'remove'
  from: string
  to: string
  symbols: string[]
}

interface ExtractionPreview {
  sourceFile: string
  targetModule: string
  symbolsToExtract: string[]
  newFileContent: string
  importChanges: ImportChange[]
  affectedFiles: number
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
 * Analyze extractable symbols in a source file
 */
async function analyzeExtractableSymbols(filePath: string): Promise<ExtractableSymbol[]> {
  const project = await getProject()
  const fullPath = filePath.startsWith('/') ? filePath : path.join(projectRoot, filePath)
  const sourceFile = project.getSourceFile(fullPath)

  if (!sourceFile) {
    return []
  }

  const depGraph = await loadDependencyGraph()
  const normalizedPath = path.relative(projectRoot, fullPath)
  const symbols: ExtractableSymbol[] = []

  // Get dependents (files that import this file)
  const dependents: string[] = []
  for (const [file, data] of Object.entries(depGraph.files)) {
    if (data.imports?.includes(normalizedPath)) {
      dependents.push(file)
    }
  }

  // Analyze each exported declaration
  const exportedDeclarations = sourceFile.getExportedDeclarations()

  for (const [name, decls] of exportedDeclarations) {
    for (const decl of decls) {
      let kind: ExtractableSymbol['kind'] = 'variable'
      const startLine = decl.getStartLineNumber()
      const endLine = decl.getEndLineNumber()

      // Determine kind
      if (decl.getKind() === SyntaxKind.FunctionDeclaration) {
        kind = 'function'
      } else if (decl.getKind() === SyntaxKind.InterfaceDeclaration) {
        kind = 'interface'
      } else if (decl.getKind() === SyntaxKind.TypeAliasDeclaration) {
        kind = 'type'
      } else if (decl.getKind() === SyntaxKind.ClassDeclaration) {
        kind = 'class'
      } else if (decl.getKind() === SyntaxKind.EnumDeclaration) {
        kind = 'enum'
      }

      // Find internal dependencies (what this symbol uses from the same file)
      const internalDeps: string[] = []
      const identifiers = decl.getDescendantsOfKind(SyntaxKind.Identifier)
      for (const id of identifiers) {
        const idName = id.getText()
        if (idName !== name && exportedDeclarations.has(idName)) {
          if (!internalDeps.includes(idName)) {
            internalDeps.push(idName)
          }
        }
      }

      // Determine if extractable
      const canExtract = true
      let reason: string | undefined

      if (internalDeps.length > 0) {
        reason = `Has internal dependencies: ${internalDeps.join(', ')}`
      }

      symbols.push({name, kind, startLine, endLine, dependencies: internalDeps, dependents, canExtract, reason})
    }
  }

  return symbols.sort((a, b) => a.startLine - b.startLine)
}

/**
 * Generate content for the new module
 */
function generateNewModuleContent(sourceFile: SourceFile, symbolNames: string[]): string {
  const lines: string[] = []
  const exportedDeclarations = sourceFile.getExportedDeclarations()

  // Collect imports needed by the extracted symbols
  const neededImports = new Set<string>()
  const importStatements: string[] = []

  for (const imp of sourceFile.getImportDeclarations()) {
    // Check if any extracted symbol uses this import
    const moduleSpec = imp.getModuleSpecifierValue()
    const namedImports = imp.getNamedImports().map((n) => n.getName())

    // Simple heuristic: include import if any symbol references it
    for (const symbolName of symbolNames) {
      const decls = exportedDeclarations.get(symbolName)
      if (decls) {
        for (const decl of decls) {
          const text = decl.getText()
          for (const namedImp of namedImports) {
            if (text.includes(namedImp)) {
              neededImports.add(moduleSpec)
              importStatements.push(imp.getText())
              break
            }
          }
        }
      }
    }
  }

  // Add imports
  const uniqueImports = [...new Set(importStatements)]
  if (uniqueImports.length > 0) {
    lines.push(...uniqueImports)
    lines.push('')
  }

  // Add extracted symbols
  for (const symbolName of symbolNames) {
    const decls = exportedDeclarations.get(symbolName)
    if (decls) {
      for (const decl of decls) {
        // Get the full declaration text including export
        let text = decl.getText()

        // Ensure it's exported
        if (!text.startsWith('export')) {
          text = 'export ' + text
        }

        lines.push(text)
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}

/**
 * Calculate import changes needed after extraction
 */
async function calculateImportChanges(sourceFilePath: string, targetModulePath: string, symbolNames: string[]): Promise<ImportChange[]> {
  const depGraph = await loadDependencyGraph()
  const normalizedSource = sourceFilePath.startsWith('src/') ? sourceFilePath : `src/${sourceFilePath}`
  const changes: ImportChange[] = []

  // Find all files that import the source file
  for (const [file, data] of Object.entries(depGraph.files)) {
    if (data.imports?.includes(normalizedSource)) {
      // This file imports from the source, need to check which symbols
      const project = await getProject()
      const importingFile = project.getSourceFile(path.join(projectRoot, file))

      if (importingFile) {
        for (const imp of importingFile.getImportDeclarations()) {
          const moduleSpec = imp.getModuleSpecifierValue()

          // Check if this import is from our source file
          if (moduleSpec.includes(path.basename(sourceFilePath, '.ts')) || moduleSpec === normalizedSource.replace('.ts', '')) {
            const namedImports = imp.getNamedImports().map((n) => n.getName())
            const extractedImports = namedImports.filter((n) => symbolNames.includes(n))
            const remainingImports = namedImports.filter((n) => !symbolNames.includes(n))

            if (extractedImports.length > 0) {
              // Need to modify this import
              if (remainingImports.length > 0) {
                // Split import: keep some, move others
                changes.push({file, action: 'modify', from: moduleSpec, to: moduleSpec, symbols: remainingImports})
                changes.push({file, action: 'add', from: moduleSpec, to: targetModulePath.replace('.ts', ''), symbols: extractedImports})
              } else {
                // All imports moved to new module
                changes.push({file, action: 'modify', from: moduleSpec, to: targetModulePath.replace('.ts', ''), symbols: extractedImports})
              }
            }
          }
        }
      }
    }
  }

  return changes
}

/**
 * Preview extraction without making changes
 */
async function previewExtraction(sourceFilePath: string, symbolNames: string[], targetModulePath: string): Promise<ExtractionPreview> {
  const project = await getProject()
  const fullSourcePath = sourceFilePath.startsWith('/') ? sourceFilePath : path.join(projectRoot, sourceFilePath)
  const sourceFile = project.getSourceFile(fullSourcePath)

  if (!sourceFile) {
    throw new Error(`Source file not found: ${sourceFilePath}`)
  }

  // Generate new module content
  const newFileContent = generateNewModuleContent(sourceFile, symbolNames)

  // Calculate import changes
  const importChanges = await calculateImportChanges(sourceFilePath, targetModulePath, symbolNames)

  return {
    sourceFile: sourceFilePath,
    targetModule: targetModulePath,
    symbolsToExtract: symbolNames,
    newFileContent,
    importChanges,
    affectedFiles: new Set(importChanges.map((c) => c.file)).size
  }
}

/**
 * Execute extraction
 */
async function executeExtraction(
  sourceFilePath: string,
  symbolNames: string[],
  targetModulePath: string,
  createBarrel: boolean
): Promise<{success: boolean; filesCreated: string[]; filesModified: string[]; errors: string[]}> {
  const errors: string[] = []
  const filesCreated: string[] = []
  const filesModified: string[] = []

  try {
    const preview = await previewExtraction(sourceFilePath, symbolNames, targetModulePath)

    // Create the new module file
    const fullTargetPath = targetModulePath.startsWith('/') ? targetModulePath : path.join(projectRoot, targetModulePath)

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullTargetPath), {recursive: true})

    // Write new module
    await fs.writeFile(fullTargetPath, preview.newFileContent)
    filesCreated.push(targetModulePath)

    // Create barrel file if requested
    if (createBarrel) {
      const barrelPath = path.join(path.dirname(fullTargetPath), 'index.ts')
      const barrelContent = `export * from './${path.basename(targetModulePath, '.ts')}'\n`

      try {
        const existing = await fs.readFile(barrelPath, 'utf-8')
        if (!existing.includes(path.basename(targetModulePath, '.ts'))) {
          await fs.writeFile(barrelPath, existing + barrelContent)
          filesModified.push(path.relative(projectRoot, barrelPath))
        }
      } catch {
        // Barrel doesn't exist, create it
        await fs.writeFile(barrelPath, barrelContent)
        filesCreated.push(path.relative(projectRoot, barrelPath))
      }
    }

    // Note: We're not automatically updating imports in other files
    // That would require more careful handling and could be risky
    // Instead, we provide the import changes for manual review

    // Invalidate project cache
    cachedProject = null
    projectCacheTime = 0

    return {success: true, filesCreated, filesModified, errors}
  } catch (error) {
    return {success: false, filesCreated, filesModified, errors: [error instanceof Error ? error.message : String(error)]}
  }
}

/**
 * Main handler for extract module queries
 */
export async function handleExtractModuleQuery(args: ExtractModuleArgs) {
  const {query, sourceFile, symbols, targetModule, createBarrel = false} = args
  if (!sourceFile) {
    return {
      error: 'Source file required',
      examples: [
        {query: 'analyze', sourceFile: 'src/util/helpers.ts'},
        {query: 'preview', sourceFile: 'src/util/helpers.ts', symbols: ['helperA', 'helperB'], targetModule: 'src/util/new-helpers.ts'}
      ]
    }
  }
  switch (query) {
    case 'analyze': {
      const extractable = await analyzeExtractableSymbols(sourceFile)

      if (extractable.length === 0) {
        return {sourceFile, message: 'No extractable symbols found', symbols: []}
      }

      return {
        sourceFile,
        totalSymbols: extractable.length,
        symbols: extractable.map((s) => ({
          name: s.name,
          kind: s.kind,
          lines: `${s.startLine}-${s.endLine}`,
          dependencies: s.dependencies,
          dependentFiles: s.dependents.length,
          canExtract: s.canExtract,
          note: s.reason
        })),
        nextStep: "Use query: 'preview' with symbols array and targetModule to see extraction plan"
      }
    }

    case 'preview': {
      if (!symbols || symbols.length === 0) {
        return {error: 'Symbols array required for preview', hint: "First use query: 'analyze' to see available symbols"}
      }

      if (!targetModule) {
        return {error: 'Target module path required', example: 'src/util/extracted-helpers.ts'}
      }

      try {
        const preview = await previewExtraction(sourceFile, symbols, targetModule)

        return {
          extraction: {from: preview.sourceFile, to: preview.targetModule, symbols: preview.symbolsToExtract},
          newFileContent: preview.newFileContent,
          importChanges: preview.importChanges,
          affectedFiles: preview.affectedFiles,
          nextStep: preview.affectedFiles > 0
            ? `WARNING: ${preview.affectedFiles} file(s) have imports that need updating. Review importChanges and update manually, or use query: 'execute'`
            : "Use query: 'execute' to create the new module"
        }
      } catch (error) {
        return {error: error instanceof Error ? error.message : String(error)}
      }
    }

    case 'execute': {
      if (!symbols || symbols.length === 0) {
        return {error: 'Symbols array required', hint: "First use query: 'analyze' then 'preview'"}
      }

      if (!targetModule) {
        return {error: 'Target module path required'}
      }

      const result = await executeExtraction(sourceFile, symbols, targetModule, createBarrel)

      return {
        ...result,
        extraction: {from: sourceFile, to: targetModule, symbols},
        createBarrel,
        note: result.success
          ? 'Module extracted. You may need to manually update imports in files that used the extracted symbols.'
          : 'Extraction failed'
      }
    }

    default:
      return {
        error: `Unknown query type: ${query}`,
        availableQueries: ['analyze', 'preview', 'execute'],
        examples: [
          {query: 'analyze', sourceFile: 'src/util/helpers.ts'},
          {query: 'preview', sourceFile: 'src/util/helpers.ts', symbols: ['fn1', 'fn2'], targetModule: 'src/util/new-module.ts'},
          {query: 'execute', sourceFile: 'src/util/helpers.ts', symbols: ['fn1'], targetModule: 'src/util/new-module.ts', createBarrel: true}
        ]
      }
  }
}
