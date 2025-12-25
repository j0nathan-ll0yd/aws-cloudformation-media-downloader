/**
 * Bundle size analysis handler for MCP server
 * Analyze Lambda bundle sizes and provide optimization suggestions
 *
 * Features:
 * - Summary of all Lambda bundle sizes
 * - Detailed breakdown by module
 * - Comparison between git refs
 * - Optimization suggestions
 */

import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'url'
import {discoverLambdas} from '../data-loader.js'
import {execGit} from '../shared/git-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../..')

export type BundleSizeQueryType = 'summary' | 'breakdown' | 'compare' | 'optimize'

export interface BundleSizeArgs {
  query: BundleSizeQueryType
  lambda?: string
  compareRef?: string
  threshold?: number
}

interface BundleInfo {
  lambda: string
  totalSize: number
  files: number
  largestModules: Array<{module: string; size: number}>
}

interface BundleBreakdown {
  lambda: string
  totalSize: number
  nodeModules: {bytes: number; percentage: number; modules: Array<{name: string; size: number}>}
  src: {bytes: number; percentage: number; files: Array<{name: string; size: number}>}
  external: string[]
}

interface OptimizationSuggestion {
  type: 'externalize' | 'tree-shake' | 'lazy-import' | 'split'
  target: string
  currentSize: number
  estimatedSavings: number
  effort: 'low' | 'medium' | 'high'
  description: string
}

/**
 * Get build output directory for a Lambda
 */
function getLambdaBuildPath(lambdaName: string): string {
  return path.join(projectRoot, 'dist', lambdaName)
}

/**
 * Get metafile path for a Lambda
 */
function getMetafilePath(lambdaName: string): string {
  return path.join(projectRoot, 'build', 'reports', `${lambdaName}-meta.json`)
}

/**
 * Read esbuild metafile if available
 */
async function readMetafile(lambdaName: string): Promise<Record<string, unknown> | null> {
  const metaPath = getMetafilePath(lambdaName)
  try {
    const content = await fs.readFile(metaPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Estimate bundle size by analyzing dist directory
 */
async function estimateBundleSize(lambdaName: string): Promise<number> {
  const distPath = getLambdaBuildPath(lambdaName)
  try {
    const entries = await fs.readdir(distPath)
    let totalSize = 0
    for (const entry of entries) {
      const stat = await fs.stat(path.join(distPath, entry))
      totalSize += stat.size
    }
    return totalSize
  } catch {
    // No dist directory, estimate from source
    return estimateFromSource(lambdaName)
  }
}

/**
 * Estimate bundle size from source files
 */
async function estimateFromSource(lambdaName: string): Promise<number> {
  const srcPath = path.join(projectRoot, 'src', 'lambdas', lambdaName, 'src')
  try {
    const entries = await fs.readdir(srcPath, {recursive: true})
    let totalSize = 0
    for (const entry of entries) {
      if (typeof entry === 'string' && entry.endsWith('.ts')) {
        try {
          const stat = await fs.stat(path.join(srcPath, entry))
          totalSize += stat.size
        } catch {
          // Skip unreadable files
        }
      }
    }
    // Rough estimation: compiled JS is ~80% of TS size, plus node_modules overhead
    return Math.round(totalSize * 0.8 * 2)
  } catch {
    return 0
  }
}

/**
 * Get bundle summary for all Lambdas
 */
async function getBundleSummary(): Promise<BundleInfo[]> {
  const lambdas = await discoverLambdas()
  const summaries: BundleInfo[] = []

  for (const lambda of lambdas) {
    const metafile = await readMetafile(lambda)
    let totalSize = 0
    let files = 0
    const largestModules: Array<{module: string; size: number}> = []

    if (metafile && typeof metafile === 'object' && 'outputs' in metafile) {
      const outputs = metafile.outputs as Record<string, {bytes: number; inputs: Record<string, {bytesInOutput: number}>}>
      for (const [, output] of Object.entries(outputs)) {
        totalSize += output.bytes || 0
        if (output.inputs) {
          for (const [inputPath, inputData] of Object.entries(output.inputs)) {
            files++
            largestModules.push({module: inputPath, size: inputData.bytesInOutput})
          }
        }
      }
      // Sort and keep top 5
      largestModules.sort((a, b) => b.size - a.size)
      largestModules.splice(5)
    } else {
      // Estimate from filesystem
      totalSize = await estimateBundleSize(lambda)
    }

    summaries.push({lambda, totalSize, files, largestModules})
  }

  return summaries.sort((a, b) => b.totalSize - a.totalSize)
}

/**
 * Get detailed breakdown for a Lambda
 */
async function getBundleBreakdown(lambdaName: string): Promise<BundleBreakdown | null> {
  const metafile = await readMetafile(lambdaName)

  if (!metafile || typeof metafile !== 'object' || !('outputs' in metafile)) {
    // Return estimated breakdown
    const totalSize = await estimateBundleSize(lambdaName)
    return {
      lambda: lambdaName,
      totalSize,
      nodeModules: {bytes: Math.round(totalSize * 0.6), percentage: 60, modules: []},
      src: {bytes: Math.round(totalSize * 0.4), percentage: 40, files: []},
      external: ['@aws-sdk/*']
    }
  }

  const outputs = metafile.outputs as Record<string, {bytes: number; inputs: Record<string, {bytesInOutput: number}>}>
  let totalSize = 0
  let nodeModulesSize = 0
  let srcSize = 0
  const nodeModulesBreakdown: Array<{name: string; size: number}> = []
  const srcBreakdown: Array<{name: string; size: number}> = []

  for (const [, output] of Object.entries(outputs)) {
    totalSize += output.bytes || 0
    if (output.inputs) {
      for (const [inputPath, inputData] of Object.entries(output.inputs)) {
        if (inputPath.includes('node_modules')) {
          nodeModulesSize += inputData.bytesInOutput
          // Extract package name
          const match = inputPath.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)
          if (match) {
            const existing = nodeModulesBreakdown.find((m) => m.name === match[1])
            if (existing) {
              existing.size += inputData.bytesInOutput
            } else {
              nodeModulesBreakdown.push({name: match[1], size: inputData.bytesInOutput})
            }
          }
        } else {
          srcSize += inputData.bytesInOutput
          srcBreakdown.push({name: inputPath, size: inputData.bytesInOutput})
        }
      }
    }
  }

  nodeModulesBreakdown.sort((a, b) => b.size - a.size)
  srcBreakdown.sort((a, b) => b.size - a.size)

  return {
    lambda: lambdaName,
    totalSize,
    nodeModules: {
      bytes: nodeModulesSize,
      percentage: totalSize > 0 ? Math.round((nodeModulesSize / totalSize) * 100) : 0,
      modules: nodeModulesBreakdown.slice(0, 10)
    },
    src: {bytes: srcSize, percentage: totalSize > 0 ? Math.round((srcSize / totalSize) * 100) : 0, files: srcBreakdown.slice(0, 10)},
    external: ['@aws-sdk/*']
  }
}

/**
 * Compare bundle sizes between refs
 */
async function compareBundles(lambdaName: string | undefined, compareRef: string): Promise<
  {current: BundleInfo[]; previous: BundleInfo[]; changes: Array<{lambda: string; current: number; previous: number; delta: number; deltaPercent: number}>}
> {
  const currentSummaries = await getBundleSummary()

  // Get previous bundle sizes from git ref
  // This would require checking out the ref and building, so we provide an approximation
  const previousSummaries: BundleInfo[] = []

  // Try to get file sizes from git ref
  for (const summary of currentSummaries) {
    if (lambdaName && summary.lambda !== lambdaName) {
      continue
    }

    try {
      // Get the main source file size at the ref
      const entryPoint = `src/lambdas/${summary.lambda}/src/index.ts`
      const result = execGit(['show', `${compareRef}:${entryPoint}`])
      const previousSize = result.length * 2 // Rough estimation

      previousSummaries.push({lambda: summary.lambda, totalSize: previousSize, files: 0, largestModules: []})
    } catch {
      // File didn't exist at that ref
      previousSummaries.push({lambda: summary.lambda, totalSize: 0, files: 0, largestModules: []})
    }
  }

  // Calculate changes
  const changes = currentSummaries.filter((c) => !lambdaName || c.lambda === lambdaName).map((current) => {
    const previous = previousSummaries.find((p) => p.lambda === current.lambda)
    const prevSize = previous?.totalSize || 0
    const delta = current.totalSize - prevSize
    const deltaPercent = prevSize > 0 ? Math.round((delta / prevSize) * 100) : 100

    return {lambda: current.lambda, current: current.totalSize, previous: prevSize, delta, deltaPercent}
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  return {current: currentSummaries.filter((c) => !lambdaName || c.lambda === lambdaName), previous: previousSummaries, changes}
}

/**
 * Generate optimization suggestions
 */
async function getOptimizationSuggestions(lambdaName: string): Promise<OptimizationSuggestion[]> {
  const breakdown = await getBundleBreakdown(lambdaName)
  if (!breakdown) {
    return []
  }

  const suggestions: OptimizationSuggestion[] = []

  // Check for large node_modules packages
  for (const mod of breakdown.nodeModules.modules) {
    if (mod.size > 50000) {
      // Over 50KB
      suggestions.push({
        type: 'externalize',
        target: mod.name,
        currentSize: mod.size,
        estimatedSavings: Math.round(mod.size * 0.8),
        effort: 'low',
        description: `Consider externalizing ${mod.name} (${formatBytes(mod.size)}) to reduce bundle size`
      })
    }
  }

  // Check if AWS SDK is bundled
  const awsSdkModules = breakdown.nodeModules.modules.filter((m) => m.name.startsWith('@aws-sdk/'))
  if (awsSdkModules.length > 0) {
    const totalAwsSdk = awsSdkModules.reduce((sum, m) => sum + m.size, 0)
    suggestions.push({
      type: 'externalize',
      target: '@aws-sdk/*',
      currentSize: totalAwsSdk,
      estimatedSavings: totalAwsSdk,
      effort: 'low',
      description: `AWS SDK should be external - Lambda runtime provides it (${formatBytes(totalAwsSdk)} wasted)`
    })
  }

  // Check for tree-shaking opportunities
  if (breakdown.totalSize > 500000) {
    // Over 500KB
    suggestions.push({
      type: 'tree-shake',
      target: lambdaName,
      currentSize: breakdown.totalSize,
      estimatedSavings: Math.round(breakdown.totalSize * 0.2),
      effort: 'medium',
      description: 'Large bundle may benefit from improved tree-shaking configuration'
    })
  }

  // Check for lazy import opportunities
  if (breakdown.src.files.length > 10) {
    suggestions.push({
      type: 'lazy-import',
      target: `${lambdaName}/src`,
      currentSize: breakdown.src.bytes,
      estimatedSavings: Math.round(breakdown.src.bytes * 0.3),
      effort: 'medium',
      description: 'Consider lazy imports for conditionally used modules'
    })
  }

  return suggestions.sort((a, b) => b.estimatedSavings - a.estimatedSavings)
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

/**
 * Main handler for bundle size queries
 */
export async function handleBundleSizeQuery(args: BundleSizeArgs) {
  const {query, lambda, compareRef, threshold = 100000} = args

  switch (query) {
    case 'summary': {
      const summaries = await getBundleSummary()

      // Filter by lambda if specified
      const filtered = lambda ? summaries.filter((s) => s.lambda === lambda) : summaries

      // Check for threshold violations
      const violations = filtered.filter((s) => s.totalSize > threshold)

      return {
        totalLambdas: filtered.length,
        totalSize: filtered.reduce((sum, s) => sum + s.totalSize, 0),
        averageSize: Math.round(filtered.reduce((sum, s) => sum + s.totalSize, 0) / filtered.length),
        threshold: formatBytes(threshold),
        violations: violations.length,
        lambdas: filtered.map((s) => ({
          name: s.lambda,
          size: formatBytes(s.totalSize),
          sizeBytes: s.totalSize,
          files: s.files,
          exceedsThreshold: s.totalSize > threshold
        })),
        largest: filtered.slice(0, 5).map((s) => ({
          name: s.lambda,
          size: formatBytes(s.totalSize),
          topModules: s.largestModules.map((m) => ({module: m.module, size: formatBytes(m.size)}))
        }))
      }
    }

    case 'breakdown': {
      if (!lambda) {
        return {error: 'Lambda name required for breakdown query', example: {query: 'breakdown', lambda: 'ListFiles'}}
      }

      const breakdown = await getBundleBreakdown(lambda)

      if (!breakdown) {
        return {error: `Lambda not found: ${lambda}`}
      }

      return {
        lambda: breakdown.lambda,
        totalSize: formatBytes(breakdown.totalSize),
        totalSizeBytes: breakdown.totalSize,
        breakdown: {
          nodeModules: {
            size: formatBytes(breakdown.nodeModules.bytes),
            percentage: breakdown.nodeModules.percentage,
            topPackages: breakdown.nodeModules.modules.map((m) => ({package: m.name, size: formatBytes(m.size)}))
          },
          src: {
            size: formatBytes(breakdown.src.bytes),
            percentage: breakdown.src.percentage,
            topFiles: breakdown.src.files.map((f) => ({file: f.name, size: formatBytes(f.size)}))
          }
        },
        external: breakdown.external,
        note: breakdown.nodeModules.modules.length === 0
          ? 'Detailed breakdown requires esbuild metafile (build/reports/*-meta.json)'
          : undefined
      }
    }

    case 'compare': {
      const ref = compareRef || 'HEAD~1'

      try {
        const comparison = await compareBundles(lambda, ref)

        const significantChanges = comparison.changes.filter((c) => Math.abs(c.deltaPercent) > 5)

        return {
          baseRef: ref,
          headRef: 'HEAD',
          lambdasCompared: comparison.changes.length,
          summary: {
            increased: comparison.changes.filter((c) => c.delta > 0).length,
            decreased: comparison.changes.filter((c) => c.delta < 0).length,
            unchanged: comparison.changes.filter((c) => c.delta === 0).length
          },
          significantChanges: significantChanges.map((c) => ({
            lambda: c.lambda,
            previous: formatBytes(c.previous),
            current: formatBytes(c.current),
            delta: `${c.delta > 0 ? '+' : ''}${formatBytes(c.delta)}`,
            deltaPercent: `${c.delta > 0 ? '+' : ''}${c.deltaPercent}%`
          })),
          allChanges: comparison.changes.map((c) => ({lambda: c.lambda, delta: c.delta, deltaPercent: c.deltaPercent})),
          note: 'Comparison is estimated from source file sizes. For accurate comparison, build both refs.'
        }
      } catch (error) {
        return {
          error: `Comparison failed: ${error instanceof Error ? error.message : String(error)}`,
          hint: `Ensure ref '${ref}' exists and contains Lambda source files`
        }
      }
    }

    case 'optimize': {
      if (!lambda) {
        return {error: 'Lambda name required for optimize query', example: {query: 'optimize', lambda: 'ListFiles'}}
      }

      const suggestions = await getOptimizationSuggestions(lambda)

      if (suggestions.length === 0) {
        return {lambda, message: 'No optimization suggestions found', note: 'Bundle appears well-optimized or detailed analysis requires esbuild metafile'}
      }

      const totalSavings = suggestions.reduce((sum, s) => sum + s.estimatedSavings, 0)

      return {
        lambda,
        totalPotentialSavings: formatBytes(totalSavings),
        suggestions: suggestions.map((s) => ({
          type: s.type,
          target: s.target,
          currentSize: formatBytes(s.currentSize),
          estimatedSavings: formatBytes(s.estimatedSavings),
          effort: s.effort,
          description: s.description
        })),
        priority: suggestions.slice(0, 3).map((s) => `${s.type}: ${s.target} (save ${formatBytes(s.estimatedSavings)})`)
      }
    }

    default:
      return {
        error: `Unknown query type: ${query}`,
        availableQueries: ['summary', 'breakdown', 'compare', 'optimize'],
        examples: [
          {query: 'summary'},
          {query: 'summary', threshold: 200000},
          {query: 'breakdown', lambda: 'ListFiles'},
          {query: 'compare', compareRef: 'HEAD~5'},
          {query: 'optimize', lambda: 'WebhookFeedly'}
        ]
      }
  }
}
