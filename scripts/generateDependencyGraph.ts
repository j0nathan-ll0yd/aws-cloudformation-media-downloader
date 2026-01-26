import {Project, SourceFile, SyntaxKind} from 'ts-morph'
import {writeFileSync, mkdirSync} from 'fs'
import {dirname, relative, resolve, join} from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

if (process.env['LOG_LEVEL']?.toUpperCase() === 'SILENT') {
  console.log = () => {}
}

interface NamedImport {
  name: string
  isTypeOnly: boolean
}

interface ImportEntry {
  path: string
  namedImports?: NamedImport[]
}

interface FileImport {
  file: string
  imports: ImportEntry[]
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
 * Path alias mappings from tsconfig.json
 */
const pathAliases: Record<string, string> = {
  '#entities/': 'src/entities/',
  '#lambdas/': 'src/lambdas/',
  '#lib/': 'src/lib/',
  '#util/': 'src/util/',
  '#config/': 'src/config/',
  '#types/': 'src/types/',
  '#test/': 'test/'
}

/**
 * Resolves an import path to a relative project path.
 * Returns the actual file path that exists in the project.
 */
function resolveImportPath(sourceFile: SourceFile, importPath: string, projectRoot: string, project: Project): string | null {
  // Handle path aliases (e.g., #entities/queries)
  for (const [alias, replacement] of Object.entries(pathAliases)) {
    if (importPath.startsWith(alias)) {
      const resolvedAlias = importPath.replace(alias, replacement)
      // Try extensions in order of preference - prefer explicit files over barrel imports
      const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx']
      for (const ext of extensions) {
        const testPath = resolvedAlias + ext
        const fullPath = join(projectRoot, testPath)
        // Check if this file actually exists in the project
        if (project.getSourceFile(fullPath)) {
          return testPath
        }
      }
      // If no file found with extensions, it might be a directory barrel - return with /index.ts
      const barrelPath = resolvedAlias + '/index.ts'
      const fullBarrelPath = join(projectRoot, barrelPath)
      if (project.getSourceFile(fullBarrelPath)) {
        return barrelPath
      }
    }
  }

  // Ignore node_modules imports (non-relative, non-aliased)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null
  }

  const sourceDir = dirname(sourceFile.getFilePath())
  const resolvedPath = resolve(sourceDir, importPath)

  // Try extensions in order of preference
  const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx']
  for (const ext of extensions) {
    const testPath = resolvedPath + ext
    // Check if this file actually exists in the project
    if (project.getSourceFile(testPath)) {
      const relativePath = relative(projectRoot, testPath)
      if (relativePath.startsWith('src/') || relativePath.startsWith('test/') || relativePath.startsWith('config/')) {
        return relativePath
      }
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
  for (const importEntry of fileData.imports) {
    transitive.push(importEntry.path)
    const nested = getTransitiveDependencies(importEntry.path, graph, visited)
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
    const imports: ImportEntry[] = []

    // Get all import declarations
    const importDeclarations = sourceFile.getImportDeclarations()
    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue()
      const resolvedPath = resolveImportPath(sourceFile, moduleSpecifier, projectRoot, project)

      if (resolvedPath) {
        // Extract named imports (skip type-only imports)
        const namedImportNodes = importDecl.getNamedImports()
        const namedImports: NamedImport[] = namedImportNodes
          .filter((ni) => !ni.isTypeOnly())
          .map((ni) => ({
            name: ni.getName(),
            isTypeOnly: false
          }))

        imports.push({
          path: resolvedPath,
          namedImports: namedImports.length > 0 ? namedImports : undefined
        })
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
        const resolvedPath = resolveImportPath(sourceFile, moduleSpecifier, projectRoot, project)

        if (resolvedPath) {
          // Dynamic imports don't have static named imports
          imports.push({path: resolvedPath})
        }
      }
    }

    if (imports.length > 0) {
      // Deduplicate by path while preserving named imports
      const seen = new Map<string, ImportEntry>()
      for (const entry of imports) {
        const existing = seen.get(entry.path)
        if (existing) {
          // Merge named imports if both have them
          if (entry.namedImports && existing.namedImports) {
            const allNames = new Set([
              ...existing.namedImports.map((n) => n.name),
              ...entry.namedImports.map((n) => n.name)
            ])
            existing.namedImports = Array.from(allNames).map((name) => ({name, isTypeOnly: false}))
          } else if (entry.namedImports) {
            existing.namedImports = entry.namedImports
          }
        } else {
          seen.set(entry.path, entry)
        }
      }
      graph[filePath] = {
        file: filePath,
        imports: Array.from(seen.values()).sort((a, b) => a.path.localeCompare(b.path))
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
