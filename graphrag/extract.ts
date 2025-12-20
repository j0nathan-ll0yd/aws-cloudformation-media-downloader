#!/usr/bin/env node
/**
 * GraphRAG extraction for Lambda chains and entity relationships
 * Builds a knowledge graph from the codebase for multi-hop reasoning
 *
 * This script dynamically discovers:
 * - Lambdas from src/lambdas/ directory
 * - Entity relationships from src/entities/ directory
 * - Service dependencies from build/graph.json transitive dependencies
 *
 * Semantic metadata (triggers, purposes) is read from graphrag/metadata.json
 */

import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

interface Node {
  id: string
  type: 'Lambda' | 'Entity' | 'Service' | 'External'
  properties: Record<string, unknown>
}

interface Edge {
  source: string
  target: string
  relationship: string
  properties?: Record<string, unknown>
}

interface KnowledgeGraph {
  nodes: Node[]
  edges: Edge[]
  metadata: {
    version: string
    description: string
    sources: {
      lambdas: string
      dependencies: string
      metadata: string
    }
  }
}

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

interface Metadata {
  lambdas: Record<string, LambdaMetadata>
  externalServices: ServiceMetadata[]
  awsServices: ServiceMetadata[]
  entityRelationships: Array<{from: string; to: string; type: string}>
  lambdaInvocations: Array<{from: string; to: string; via: string}>
  serviceToServiceEdges: Array<{from: string; to: string; relationship: string; event?: string}>
}

/**
 * Discover Lambda names from src/lambdas/ directory
 */
async function discoverLambdas(): Promise<string[]> {
  const lambdasDir = path.join(projectRoot, 'src', 'lambdas')
  const entries = await fs.readdir(lambdasDir, {withFileTypes: true})
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

/**
 * Discover Entity names from src/entities/ directory
 */
async function discoverEntities(): Promise<string[]> {
  const entitiesDir = path.join(projectRoot, 'src', 'entities')
  const entries = await fs.readdir(entitiesDir)
  return entries.filter((e) => e.endsWith('.ts') && !e.includes('.test.') && e !== 'Collections.ts').map((e) => e.replace('.ts', ''))
}

/**
 * Load the dependency graph from build/graph.json
 */
async function loadDependencyGraph(): Promise<DependencyGraph> {
  const graphPath = path.join(projectRoot, 'build', 'graph.json')
  const content = await fs.readFile(graphPath, 'utf-8')
  return JSON.parse(content)
}

/**
 * Load semantic metadata from graphrag/metadata.json
 */
async function loadMetadata(): Promise<Metadata> {
  const metadataPath = path.join(__dirname, 'metadata.json')
  const content = await fs.readFile(metadataPath, 'utf-8')
  return JSON.parse(content)
}

/**
 * Extract AWS services used by a Lambda from its transitive dependencies
 */
function extractAwsServices(deps: string[], awsServices: ServiceMetadata[]): string[] {
  const services: Set<string> = new Set()

  for (const dep of deps) {
    // Match src/lib/vendor/AWS/* patterns
    const awsMatch = dep.match(/src\/lib\/vendor\/AWS\/(\w+)/)
    if (awsMatch) {
      const vendorName = awsMatch[1]
      // Find the service name from metadata
      const service = awsServices.find((s) => s.vendorPath === `AWS/${vendorName}`)
      if (service) {
        services.add(service.name)
      }
    }
  }

  return Array.from(services)
}

/**
 * Extract external services used by a Lambda from its transitive dependencies
 */
function extractExternalServices(deps: string[], externalServices: ServiceMetadata[]): string[] {
  const services: Set<string> = new Set()

  for (const dep of deps) {
    // Match src/lib/vendor/* patterns (non-AWS)
    const vendorMatch = dep.match(/src\/lib\/vendor\/(\w+)/)
    if (vendorMatch && vendorMatch[1] !== 'AWS' && vendorMatch[1] !== 'ElectroDB') {
      const vendorName = vendorMatch[1]
      const service = externalServices.find((s) => s.name.toLowerCase() === vendorName.toLowerCase())
      if (service) {
        services.add(service.name)
      }
    }

    // Match src/types/vendor/* patterns (for Feedly, etc.)
    const typeVendorMatch = dep.match(/src\/types\/vendor\/\w+\/(\w+)/)
    if (typeVendorMatch) {
      const vendorName = typeVendorMatch[1]
      const service = externalServices.find((s) => s.name.toLowerCase() === vendorName.toLowerCase())
      if (service) {
        services.add(service.name)
      }
    }
  }

  return Array.from(services)
}

/**
 * Extract entities used by a Lambda from its transitive dependencies
 */
function extractEntities(deps: string[], knownEntities: string[]): string[] {
  const entities: Set<string> = new Set()

  for (const dep of deps) {
    const entityMatch = dep.match(/src\/entities\/(\w+)/)
    if (entityMatch) {
      const entityName = entityMatch[1]
      if (knownEntities.includes(entityName)) {
        entities.add(entityName)
      }
    }
  }

  return Array.from(entities)
}

/**
 * Extract knowledge graph from codebase
 */
export async function extractKnowledgeGraph(): Promise<KnowledgeGraph> {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Load all data sources
  const [lambdaNames, entityNames, depGraph, metadata] = await Promise.all([discoverLambdas(), discoverEntities(), loadDependencyGraph(), loadMetadata()])

  console.log(`  Discovered ${lambdaNames.length} Lambdas`)
  console.log(`  Discovered ${entityNames.length} Entities`)

  // 1. Add Lambda nodes
  for (const name of lambdaNames) {
    const lambdaMeta = metadata.lambdas[name] || {trigger: 'Unknown', purpose: 'Unknown'}
    nodes.push({
      id: `lambda:${name}`,
      type: 'Lambda',
      properties: {
        name,
        trigger: lambdaMeta.trigger,
        purpose: lambdaMeta.purpose
      }
    })
  }

  // 2. Add Entity nodes
  for (const name of entityNames) {
    nodes.push({
      id: `entity:${name}`,
      type: 'Entity',
      properties: {name}
    })
  }

  // 3. Add AWS Service nodes
  for (const service of metadata.awsServices) {
    nodes.push({
      id: `service:${service.name}`,
      type: 'Service',
      properties: {name: service.name, type: service.type}
    })
  }

  // 4. Add External Service nodes
  for (const service of metadata.externalServices) {
    nodes.push({
      id: `external:${service.name}`,
      type: 'External',
      properties: {name: service.name, type: service.type, description: service.description}
    })
  }

  // 5. Add Lambda → Service/External edges (derived from dependency graph)
  for (const lambdaName of lambdaNames) {
    const entryPoint = `src/lambdas/${lambdaName}/src/index.ts`
    const deps = depGraph.transitiveDependencies[entryPoint] || []

    // AWS Services
    const awsServices = extractAwsServices(deps, metadata.awsServices)
    for (const serviceName of awsServices) {
      edges.push({
        source: `lambda:${lambdaName}`,
        target: `service:${serviceName}`,
        relationship: 'uses'
      })
    }

    // External Services
    const extServices = extractExternalServices(deps, metadata.externalServices)
    for (const serviceName of extServices) {
      edges.push({
        source: `lambda:${lambdaName}`,
        target: `external:${serviceName}`,
        relationship: 'uses'
      })
    }

    // Entities
    const entities = extractEntities(deps, entityNames)
    for (const entityName of entities) {
      edges.push({
        source: `lambda:${lambdaName}`,
        target: `entity:${entityName}`,
        relationship: 'accesses'
      })
    }

    // Add trigger service edge based on metadata
    const lambdaMeta = metadata.lambdas[lambdaName]
    if (lambdaMeta) {
      const triggerService = metadata.awsServices.find((s) => s.name === lambdaMeta.trigger)
      if (triggerService) {
        edges.push({
          source: `service:${triggerService.name}`,
          target: `lambda:${lambdaName}`,
          relationship: 'triggers'
        })
      }
    }
  }

  // 6. Add Lambda → Lambda invocation edges (from metadata)
  for (const invocation of metadata.lambdaInvocations) {
    edges.push({
      source: `lambda:${invocation.from}`,
      target: `lambda:${invocation.to}`,
      relationship: 'invokes',
      properties: {via: invocation.via}
    })
  }

  // 7. Add Entity → Entity relationship edges (from metadata)
  for (const rel of metadata.entityRelationships) {
    edges.push({
      source: `entity:${rel.from}`,
      target: `entity:${rel.to}`,
      relationship: rel.type
    })
  }

  // 8. Add Service → Service edges (from metadata)
  for (const edge of metadata.serviceToServiceEdges) {
    const props: Record<string, unknown> = {}
    if (edge.event) props.event = edge.event

    edges.push({
      source: `service:${edge.from}`,
      target: `service:${edge.to}`,
      relationship: edge.relationship,
      ...(Object.keys(props).length > 0 && {properties: props})
    })
  }

  return {
    nodes,
    edges,
    metadata: {
      version: '2.0.0',
      description: 'Media Downloader Lambda chains and entity relationships (auto-generated)',
      sources: {
        lambdas: 'src/lambdas/',
        dependencies: 'build/graph.json',
        metadata: 'graphrag/metadata.json'
      }
    }
  }
}

/**
 * Save knowledge graph to file
 */
async function saveKnowledgeGraph(graph: KnowledgeGraph, outputPath: string) {
  await fs.writeFile(outputPath, JSON.stringify(graph, null, 2) + '\n')
  console.log(`✓ Knowledge graph saved to ${outputPath}`)
  console.log(`  Nodes: ${graph.nodes.length}`)
  console.log(`  Edges: ${graph.edges.length}`)
}

/**
 * Generate graph statistics
 */
function analyzeGraph(graph: KnowledgeGraph) {
  const stats = {
    nodeTypes: {} as Record<string, number>,
    relationshipTypes: {} as Record<string, number>,
    mostConnected: [] as Array<{node: string; connections: number}>,
    lambdaChains: [] as string[][],
    missingMetadata: [] as string[]
  }

  // Count node types
  for (const node of graph.nodes) {
    stats.nodeTypes[node.type] = (stats.nodeTypes[node.type] || 0) + 1
  }

  // Count relationship types
  for (const edge of graph.edges) {
    stats.relationshipTypes[edge.relationship] = (stats.relationshipTypes[edge.relationship] || 0) + 1
  }

  // Find most connected nodes
  const connections: Record<string, number> = {}
  for (const edge of graph.edges) {
    connections[edge.source] = (connections[edge.source] || 0) + 1
    connections[edge.target] = (connections[edge.target] || 0) + 1
  }

  stats.mostConnected = Object.entries(connections)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([node, count]) => ({node, connections: count}))

  // Find Lambda chains
  const findChains = (start: string, visited: Set<string> = new Set()): string[][] => {
    if (visited.has(start)) return []
    visited.add(start)

    const chains: string[][] = []
    const outgoing = graph.edges.filter((e) => e.source === start && e.relationship === 'invokes')

    if (outgoing.length === 0) {
      return [[start]]
    }

    for (const edge of outgoing) {
      const subChains = findChains(edge.target, new Set(visited))
      for (const subChain of subChains) {
        chains.push([start, ...subChain])
      }
    }

    return chains
  }

  // Find all Lambda invocation chains
  const lambdaNodes = graph.nodes.filter((n) => n.type === 'Lambda').map((n) => n.id)
  for (const lambda of lambdaNodes) {
    const chains = findChains(lambda)
    if (chains.length > 0 && chains.some((c) => c.length > 1)) {
      stats.lambdaChains.push(...chains.filter((c) => c.length > 1))
    }
  }

  // Find Lambdas missing metadata
  for (const node of graph.nodes) {
    if (node.type === 'Lambda' && node.properties.trigger === 'Unknown') {
      stats.missingMetadata.push(node.properties.name as string)
    }
  }

  return stats
}

// Main execution
async function main() {
  try {
    console.log('Extracting knowledge graph...')
    const graph = await extractKnowledgeGraph()

    const outputPath = path.join(__dirname, 'knowledge-graph.json')
    await saveKnowledgeGraph(graph, outputPath)

    console.log('\nGraph Statistics:')
    const stats = analyzeGraph(graph)
    console.log('Node Types:', stats.nodeTypes)
    console.log('Relationship Types:', stats.relationshipTypes)

    console.log('\nMost Connected Nodes:')
    stats.mostConnected.forEach((item) => {
      console.log(`  ${item.node}: ${item.connections} connections`)
    })

    if (stats.lambdaChains.length > 0) {
      console.log('\nLambda Invocation Chains:')
      stats.lambdaChains.forEach((chain) => {
        console.log('  ' + chain.join(' → '))
      })
    }

    if (stats.missingMetadata.length > 0) {
      console.log('\n⚠️  Lambdas missing metadata in graphrag/metadata.json:')
      stats.missingMetadata.forEach((name) => {
        console.log(`  - ${name}`)
      })
    }
  } catch (error) {
    console.error('Error extracting knowledge graph:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.url === `file://${__filename}`) {
  main()
}

export {KnowledgeGraph, Node, Edge}
