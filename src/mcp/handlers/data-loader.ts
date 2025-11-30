/**
 * Shared data loader for MCP handlers
 * Reads from the same sources as GraphRAG for consistency:
 * - build/graph.json for dependencies
 * - graphrag/metadata.json for semantic info
 * - Filesystem for Lambda/Entity discovery
 */

import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'url'

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
let cacheTime = 0
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

export { DependencyGraph, EntityRelationship, LambdaMetadata, Metadata, ServiceMetadata }
