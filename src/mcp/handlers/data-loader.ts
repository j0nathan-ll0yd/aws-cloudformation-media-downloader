/**
 * Shared data loader for MCP handlers
 * Reads from the same sources as GraphRAG for consistency:
 * - build/graph.json for dependencies
 * - graphrag/metadata.json for semantic info
 * - docs/wiki/Meta/Conventions-Tracking.md for conventions
 * - docs/wiki/ for detailed documentation
 * - Filesystem for Lambda/Entity discovery
 */

import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'url'
import {type Convention, parseConventions} from '../parsers/convention-parser'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../..')

interface DependencyGraph {
  metadata: {generated: string; projectRoot: string; totalFiles: number}
  files: Record<string, {file: string; imports: string[]}>
  transitiveDependencies: Record<string, string[]>
}

interface LambdaMetadata {
  trigger: string
  purpose: string
}

interface ServiceMetadata {
  name: string
  type: string
  vendorPath?: string | null
  description?: string
}

interface EntityRelationship {
  from: string
  to: string
  type: string
}

interface Metadata {
  lambdas: Record<string, LambdaMetadata>
  externalServices: ServiceMetadata[]
  awsServices: ServiceMetadata[]
  entityRelationships: EntityRelationship[]
  lambdaInvocations: Array<{from: string; to: string; via: string}>
  serviceToServiceEdges: Array<{from: string; to: string; relationship: string; event?: string}>
}

// Cache for loaded data
let cachedMetadata: Metadata | null = null
let cachedDepGraph: DependencyGraph | null = null
let cachedConventions: Convention[] | null = null
let cachedWikiPages: string[] | null = null
let cacheTime = 0
let conventionCacheTime = 0
let wikiCacheTime = 0
const CACHE_TTL = 60000 // 1 minute cache

/**
 * Load metadata from graphrag/metadata.json
 */
export async function loadMetadata(): Promise<Metadata> {
  const now = Date.now()
  if (cachedMetadata && now - cacheTime < CACHE_TTL) {
    return cachedMetadata
  }

  const metadataPath = path.join(projectRoot, 'graphrag', 'metadata.json')
  const content = await fs.readFile(metadataPath, 'utf-8')
  cachedMetadata = JSON.parse(content)
  cacheTime = now
  return cachedMetadata!
}

/**
 * Load dependency graph from build/graph.json
 */
export async function loadDependencyGraph(): Promise<DependencyGraph> {
  const now = Date.now()
  if (cachedDepGraph && now - cacheTime < CACHE_TTL) {
    return cachedDepGraph
  }

  const graphPath = path.join(projectRoot, 'build', 'graph.json')
  const content = await fs.readFile(graphPath, 'utf-8')
  cachedDepGraph = JSON.parse(content)
  cacheTime = now
  return cachedDepGraph!
}

/**
 * Discover Lambda names from src/lambdas/ directory
 */
export async function discoverLambdas(): Promise<string[]> {
  const lambdasDir = path.join(projectRoot, 'src', 'lambdas')
  const entries = await fs.readdir(lambdasDir, {withFileTypes: true})
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()
}

/**
 * Discover Entity names from src/entities/ directory
 */
export async function discoverEntities(): Promise<string[]> {
  const entitiesDir = path.join(projectRoot, 'src', 'entities')
  const entries = await fs.readdir(entitiesDir)
  return entries.filter((e) => e.endsWith('.ts') && !e.includes('.test.') && e !== 'Collections.ts').map((e) => e.replace('.ts', '')).sort()
}

/**
 * Get Lambda configuration by combining filesystem discovery with metadata
 */
export async function getLambdaConfigs(): Promise<
  Record<
    string,
    {name: string; trigger: string; purpose: string; dependencies: string[]; entities: string[]}
  >
> {
  const [lambdaNames, metadata, depGraph, entityNames] = await Promise.all([discoverLambdas(), loadMetadata(), loadDependencyGraph(), discoverEntities()])

  const configs: Record<string, {name: string; trigger: string; purpose: string; dependencies: string[]; entities: string[]}> = {}

  for (const name of lambdaNames) {
    const lambdaMeta = metadata.lambdas[name] || {trigger: 'Unknown', purpose: 'Unknown'}
    const entryPoint = `src/lambdas/${name}/src/index.ts`
    const deps = depGraph.transitiveDependencies[entryPoint] || []

    // Extract AWS services from dependencies
    const awsServices: string[] = []
    const entities: string[] = []

    for (const dep of deps) {
      // AWS services
      const awsMatch = dep.match(/src\/lib\/vendor\/AWS\/(\w+)/)
      if (awsMatch) {
        const service = metadata.awsServices.find((s) => s.vendorPath === `AWS/${awsMatch[1]}`)
        if (service && !awsServices.includes(service.name)) {
          awsServices.push(service.name)
        }
      }

      // Entities
      const entityMatch = dep.match(/src\/entities\/(\w+)/)
      if (entityMatch && entityNames.includes(entityMatch[1]) && !entities.includes(entityMatch[1])) {
        entities.push(entityMatch[1])
      }
    }

    configs[name] = {name, trigger: lambdaMeta.trigger, purpose: lambdaMeta.purpose, dependencies: awsServices, entities}
  }

  return configs
}

/**
 * Get entity schemas and relationships
 */
export async function getEntityInfo(): Promise<{entities: string[]; relationships: EntityRelationship[]}> {
  const [entities, metadata] = await Promise.all([discoverEntities(), loadMetadata()])

  return {entities, relationships: metadata.entityRelationships}
}

/**
 * Get Lambda invocation chains
 */
export async function getLambdaInvocations(): Promise<Array<{from: string; to: string; via: string}>> {
  const metadata = await loadMetadata()
  return metadata.lambdaInvocations
}

/**
 * Get external services
 */
export async function getExternalServices(): Promise<ServiceMetadata[]> {
  const metadata = await loadMetadata()
  return metadata.externalServices
}

/**
 * Get AWS services
 */
export async function getAwsServices(): Promise<ServiceMetadata[]> {
  const metadata = await loadMetadata()
  return metadata.awsServices
}

/**
 * Load conventions from docs/wiki/Meta/Conventions-Tracking.md
 */
export async function loadConventions(): Promise<Convention[]> {
  const now = Date.now()
  if (cachedConventions && now - conventionCacheTime < CACHE_TTL) {
    return cachedConventions
  }

  const conventionsPath = path.join(projectRoot, 'docs', 'wiki', 'Meta', 'Conventions-Tracking.md')
  const content = await fs.readFile(conventionsPath, 'utf-8')
  const parsed = parseConventions(content)
  cachedConventions = parsed.conventions
  conventionCacheTime = now
  return cachedConventions
}

/**
 * Load a specific wiki page by relative path
 */
export async function loadWikiPage(relativePath: string): Promise<string> {
  const wikiPath = path.join(projectRoot, relativePath)
  return fs.readFile(wikiPath, 'utf-8')
}

/**
 * Discover all wiki pages in docs/wiki/
 */
export async function discoverWikiPages(): Promise<string[]> {
  const now = Date.now()
  if (cachedWikiPages && now - wikiCacheTime < CACHE_TTL) {
    return cachedWikiPages
  }

  const wikiDir = path.join(projectRoot, 'docs', 'wiki')
  const pages: string[] = []

  async function walkDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, {withFileTypes: true})
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walkDir(fullPath)
      } else if (entry.name.endsWith('.md')) {
        // Return relative path from project root
        pages.push(path.relative(projectRoot, fullPath))
      }
    }
  }

  await walkDir(wikiDir)
  cachedWikiPages = pages.sort()
  wikiCacheTime = now
  return cachedWikiPages
}

/**
 * Search wiki pages for a term (searches file names and content)
 */
export async function searchWikiPages(term: string): Promise<Array<{path: string; matches: string[]}>> {
  const pages = await discoverWikiPages()
  const results: Array<{path: string; matches: string[]}> = []
  const termLower = term.toLowerCase()

  for (const pagePath of pages) {
    const content = await loadWikiPage(pagePath)

    // Check filename
    const fileNameMatch = pagePath.toLowerCase().includes(termLower)

    // Find content matches (lines containing the term)
    const lines = content.split('\n')
    const matchingLines: string[] = []
    for (const line of lines) {
      if (line.toLowerCase().includes(termLower)) {
        matchingLines.push(line.trim())
      }
    }

    if (fileNameMatch || matchingLines.length > 0) {
      results.push({path: pagePath, matches: matchingLines.slice(0, 5)}) // Limit to 5 matches per file
    }
  }

  return results
}

/**
 * Get transitive dependencies for a file
 */
export async function getTransitiveDependencies(filePath: string): Promise<string[]> {
  const depGraph = await loadDependencyGraph()
  const normalizedPath = filePath.startsWith('src/') ? filePath : `src/${filePath}`
  return depGraph.transitiveDependencies[normalizedPath] || []
}

/**
 * Find all files that import a given file (reverse dependency lookup)
 */
export async function findDependents(filePath: string): Promise<string[]> {
  const depGraph = await loadDependencyGraph()
  const normalizedPath = filePath.startsWith('src/') ? filePath : `src/${filePath}`
  const dependents: string[] = []

  for (const [file, data] of Object.entries(depGraph.files)) {
    if (data.imports?.includes(normalizedPath)) {
      dependents.push(file)
    }
  }

  return dependents.sort()
}

/**
 * Get project root path
 */
export function getProjectRoot(): string {
  return projectRoot
}

export type { Convention, DependencyGraph, EntityRelationship, LambdaMetadata, Metadata, ServiceMetadata }
