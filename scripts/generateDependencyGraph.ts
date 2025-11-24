#!/usr/bin/env ts-node

import {Project, SourceFile, SyntaxKind} from 'ts-morph'
import {writeFileSync, mkdirSync} from 'fs'
import {dirname, relative, resolve, join} from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface FileImport {
  file: string
  imports: string[]
}

interface DependencyGraph {
  metadata: {
    generated: string
    projectRoot: string
    totalFiles: number
  }
  files: Record<string, FileImport>
  transitiveDependencies: Record<string, string[]>
}

/**
 * Resolves an import path to a relative project path
 */
function resolveImportPath(sourceFile: SourceFile, importPath: string, projectRoot: string): string | null {
  // Ignore node_modules imports
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null
  }

  const sourceDir = dirname(sourceFile.getFilePath())
  const resolvedPath = resolve(sourceDir, importPath)

  // Try common extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']
  for (const ext of extensions) {
    const testPath = resolvedPath + ext
    try {
      const relativePath = relative(projectRoot, testPath)
      if (relativePath.startsWith('src/') || relativePath.startsWith('test/') || relativePath.startsWith('config/')) {
        return relativePath
      }
    } catch {
      // Path doesn't exist, try next extension
    }
  }

  return null
}

/**
 * Get all transitive dependencies for a file (recursive)
 */
function getTransitiveDependencies(file: string, graph: Record<string, FileImport>, visited = new Set<string>()): string[] {
  if (visited.has(file)) {
    return []
  }

  visited.add(file)
  const fileData = graph[file]
  if (!fileData) {
    return []
  }

  const transitive: string[] = []
  for (const importedFile of fileData.imports) {
    transitive.push(importedFile)
    const nested = getTransitiveDependencies(importedFile, graph, visited)
    transitive.push(...nested)
  }

  // Return unique dependencies
  return [...new Set(transitive)]
}

/**
 * Generate dependency graph from TypeScript project
 */
function generateDependencyGraph(): DependencyGraph {
  const projectRoot = resolve(__dirname, '..')
  const project = new Project({
    tsConfigFilePath: join(projectRoot, 'tsconfig.json')
  })

  const graph: Record<string, FileImport> = {}

  // Get all source files (excluding node_modules)
  const sourceFiles = project.getSourceFiles().filter((sf) => {
    const filePath = sf.getFilePath()
    return !filePath.includes('node_modules') && (filePath.includes('/src/') || filePath.includes('/test/') || filePath.includes('/config/'))
  })

  console.log(`Analyzing ${sourceFiles.length} files...`)

  // Build file-level import graph
  for (const sourceFile of sourceFiles) {
    const filePath = relative(projectRoot, sourceFile.getFilePath())
    const imports: string[] = []

    // Get all import declarations
    const importDeclarations = sourceFile.getImportDeclarations()
    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue()
      const resolvedPath = resolveImportPath(sourceFile, moduleSpecifier, projectRoot)

      if (resolvedPath) {
        imports.push(resolvedPath)
      }
    }

    // Get dynamic imports
    const dynamicImports = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
      const expr = call.getExpression()
      return expr.getKind() === SyntaxKind.ImportKeyword
    })

    for (const dynamicImport of dynamicImports) {
      const args = dynamicImport.getArguments()
      if (args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral) {
        const moduleSpecifier = args[0].getText().replace(/['"]/g, '')
        const resolvedPath = resolveImportPath(sourceFile, moduleSpecifier, projectRoot)

        if (resolvedPath) {
          imports.push(resolvedPath)
        }
      }
    }

    if (imports.length > 0) {
      graph[filePath] = {
        file: filePath,
        imports: [...new Set(imports)].sort()
      }
    }
  }

  console.log(`Found ${Object.keys(graph).length} files with imports`)

  // Calculate transitive dependencies
  console.log('Calculating transitive dependencies...')
  const transitiveDependencies: Record<string, string[]> = {}
  for (const file of Object.keys(graph)) {
    const transitive = getTransitiveDependencies(file, graph)
    if (transitive.length > 0) {
      transitiveDependencies[file] = transitive.sort()
    }
  }

  return {
    metadata: {
      generated: new Date().toISOString(),
      projectRoot,
      totalFiles: Object.keys(graph).length
    },
    files: graph,
    transitiveDependencies
  }
}

/**
 * Main execution
 */
function main() {
  console.log('Generating dependency graph...')

  const graph = generateDependencyGraph()

  // Ensure build directory exists
  const buildDir = resolve(__dirname, '..', 'build')
  mkdirSync(buildDir, {recursive: true})

  // Write graph to JSON
  const outputPath = join(buildDir, 'graph.json')
  writeFileSync(outputPath, JSON.stringify(graph, null, 2))

  console.log(`✓ Dependency graph generated: ${outputPath}`)
  console.log(`  Files analyzed: ${graph.metadata.totalFiles}`)
  console.log(`  Files with transitive deps: ${Object.keys(graph.transitiveDependencies).length}`)
}

// Run if executed directly
main()

export {generateDependencyGraph}
