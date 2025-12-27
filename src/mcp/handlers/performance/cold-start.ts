/**
 * Cold start analysis handler for MCP server
 * Predict cold start impact from bundle and import analysis
 *
 * Features:
 * - Estimate cold start times based on bundle size and structure
 * - Compare cold start estimates between configurations
 * - Provide optimization recommendations
 */

import {discoverLambdas, getTransitiveDependencies, loadDependencyGraph} from '../data-loader.js'
import {handleBundleSizeQuery} from './bundle-size.js'

export type ColdStartQueryType = 'estimate' | 'compare' | 'optimize'

export interface ColdStartArgs {
  query: ColdStartQueryType
  lambda?: string
  memory?: number
}

interface ColdStartFactors {
  bundleSize: number
  importDepth: number
  awsSdkClients: number
  databaseConnections: number
  httpClients: number
}

interface ColdStartEstimate {
  lambda: string
  estimatedMs: number
  confidence: 'low' | 'medium' | 'high'
  factors: ColdStartFactors
  breakdown: {initialization: number; moduleLoading: number; awsSdkInit: number; connectionSetup: number}
}

interface OptimizationRecommendation {
  impact: 'high' | 'medium' | 'low'
  category: 'bundle' | 'imports' | 'connections' | 'memory'
  recommendation: string
  estimatedImprovement: string
}

// Cold start estimation constants (based on AWS Lambda Node.js benchmarks)
const COLD_START_CONSTANTS = {
  baseOverhead: 100, // ms - Base Lambda runtime overhead
  perMbBundle: 0.5, // ms per MB of bundle size
  perImport: 2, // ms per import depth level
  perAwsClient: 50, // ms per AWS SDK client initialization
  perDbConnection: 100, // ms per database connection
  perHttpClient: 30, // ms per HTTP client setup
  memoryMultiplier: {
    // Memory size affects cold start inversely
    128: 2.0,
    256: 1.5,
    512: 1.2,
    1024: 1.0,
    2048: 0.9,
    3072: 0.85
  }
}

/**
 * Analyze cold start factors for a Lambda
 */
async function analyzeColdStartFactors(lambdaName: string): Promise<ColdStartFactors> {
  const depGraph = await loadDependencyGraph()
  const entryPoint = `src/lambdas/${lambdaName}/src/index.ts`
  const dependencies = await getTransitiveDependencies(entryPoint)

  // Calculate bundle size factor
  let bundleSize = 0
  const bundleSummary = await handleBundleSizeQuery({query: 'summary', lambda: lambdaName})
  if ('lambdas' in bundleSummary && Array.isArray(bundleSummary.lambdas)) {
    const lambdaInfo = bundleSummary.lambdas.find((l: {name: string}) => l.name === lambdaName)
    if (lambdaInfo && 'sizeBytes' in lambdaInfo) {
      bundleSize = lambdaInfo.sizeBytes as number
    }
  }

  // Calculate import depth (max depth of dependency chain)
  let maxDepth = 0
  function calculateDepth(file: string, visited: Set<string>, depth: number): number {
    if (visited.has(file)) {
      return depth
    }
    visited.add(file)

    const fileData = depGraph.files[file]
    if (!fileData?.imports) {
      return depth
    }

    let maxChildDepth = depth
    for (const imp of fileData.imports) {
      maxChildDepth = Math.max(maxChildDepth, calculateDepth(imp, visited, depth + 1))
    }
    return maxChildDepth
  }
  maxDepth = calculateDepth(entryPoint, new Set(), 0)

  // Count AWS SDK clients
  const awsSdkClients = dependencies.filter((d) => d.includes('lib/vendor/AWS/')).length

  // Count database connections (ElectroDB/DynamoDB)
  const databaseConnections = dependencies.filter((d) => d.includes('entities/') || d.includes('ElectroDB/')).length > 0 ? 1 : 0

  // Count HTTP clients
  const httpClients = dependencies.filter((d) => d.includes('vendor/') && !d.includes('AWS/') && !d.includes('ElectroDB/')).length

  return {bundleSize, importDepth: maxDepth, awsSdkClients, databaseConnections, httpClients}
}

/**
 * Estimate cold start time for a Lambda
 */
async function estimateColdStart(lambdaName: string, memory: number = 1024): Promise<ColdStartEstimate> {
  const factors = await analyzeColdStartFactors(lambdaName)

  // Calculate individual components
  const bundleSizeMb = factors.bundleSize / (1024 * 1024)
  const moduleLoading = bundleSizeMb * COLD_START_CONSTANTS.perMbBundle
  const awsSdkInit = factors.awsSdkClients * COLD_START_CONSTANTS.perAwsClient
  const connectionSetup = factors.databaseConnections * COLD_START_CONSTANTS.perDbConnection + factors.httpClients * COLD_START_CONSTANTS.perHttpClient
  const initialization = COLD_START_CONSTANTS.baseOverhead + factors.importDepth * COLD_START_CONSTANTS.perImport

  // Apply memory multiplier
  const memoryKey =
    (Object.keys(COLD_START_CONSTANTS.memoryMultiplier).map(Number).sort((a, b) => a - b).find((m) => m >= memory) ||
      3072) as keyof typeof COLD_START_CONSTANTS.memoryMultiplier

  const memoryMultiplier = COLD_START_CONSTANTS.memoryMultiplier[memoryKey]

  const totalMs = Math.round((moduleLoading + awsSdkInit + connectionSetup + initialization) * memoryMultiplier)

  // Determine confidence based on data availability
  let confidence: 'low' | 'medium' | 'high' = 'medium'
  if (factors.bundleSize === 0) {
    confidence = 'low'
  } else if (factors.bundleSize > 0 && factors.awsSdkClients > 0) {
    confidence = 'high'
  }

  return {
    lambda: lambdaName,
    estimatedMs: totalMs,
    confidence,
    factors,
    breakdown: {
      initialization: Math.round(initialization * memoryMultiplier),
      moduleLoading: Math.round(moduleLoading * memoryMultiplier),
      awsSdkInit: Math.round(awsSdkInit * memoryMultiplier),
      connectionSetup: Math.round(connectionSetup * memoryMultiplier)
    }
  }
}

/**
 * Generate optimization recommendations
 */
function getOptimizationRecommendations(estimate: ColdStartEstimate, memory: number): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = []

  // Bundle size recommendations
  if (estimate.factors.bundleSize > 5 * 1024 * 1024) {
    // Over 5MB
    recommendations.push({
      impact: 'high',
      category: 'bundle',
      recommendation: 'Reduce bundle size through tree-shaking and externalization',
      estimatedImprovement: '20-40% faster cold starts'
    })
  }

  // AWS SDK recommendations
  if (estimate.factors.awsSdkClients > 3) {
    recommendations.push({
      impact: 'high',
      category: 'imports',
      recommendation: 'Reduce AWS SDK client count or use lazy initialization',
      estimatedImprovement: `${estimate.factors.awsSdkClients * 50}ms potential savings`
    })
  }

  // Memory recommendations
  if (memory < 512 && estimate.estimatedMs > 500) {
    recommendations.push({
      impact: 'medium',
      category: 'memory',
      recommendation: 'Increase memory allocation to reduce cold start time',
      estimatedImprovement: 'Up to 50% faster with 1024MB'
    })
  }

  // Import depth recommendations
  if (estimate.factors.importDepth > 10) {
    recommendations.push({
      impact: 'low',
      category: 'imports',
      recommendation: 'Flatten import hierarchy to reduce module resolution time',
      estimatedImprovement: '5-10% faster module loading'
    })
  }

  // Database connection recommendations
  if (estimate.factors.databaseConnections > 0) {
    recommendations.push({
      impact: 'medium',
      category: 'connections',
      recommendation: 'Use connection pooling and keep-alive for database connections',
      estimatedImprovement: '50-100ms on subsequent invocations'
    })
  }

  return recommendations.sort((a, b) => {
    const order = {high: 0, medium: 1, low: 2}
    return order[a.impact] - order[b.impact]
  })
}

/**
 * Format milliseconds to readable string
 */
function formatMs(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Main handler for cold start queries
 */
export async function handleColdStartQuery(args: ColdStartArgs) {
  const {query, lambda, memory = 1024} = args

  switch (query) {
    case 'estimate': {
      const lambdas = lambda ? [lambda] : await discoverLambdas()
      const estimates: ColdStartEstimate[] = []

      for (const lambdaName of lambdas) {
        try {
          const estimate = await estimateColdStart(lambdaName, memory)
          estimates.push(estimate)
        } catch {
          // Skip lambdas that fail analysis
        }
      }

      estimates.sort((a, b) => b.estimatedMs - a.estimatedMs)

      // Categorize by severity
      const fast = estimates.filter((e) => e.estimatedMs < 300)
      const moderate = estimates.filter((e) => e.estimatedMs >= 300 && e.estimatedMs < 800)
      const slow = estimates.filter((e) => e.estimatedMs >= 800)

      return {
        memory: `${memory}MB`,
        totalLambdas: estimates.length,
        summary: {
          fast: fast.length,
          moderate: moderate.length,
          slow: slow.length,
          averageMs: Math.round(estimates.reduce((sum, e) => sum + e.estimatedMs, 0) / estimates.length)
        },
        estimates: estimates.map((e) => ({
          lambda: e.lambda,
          estimated: formatMs(e.estimatedMs),
          estimatedMs: e.estimatedMs,
          confidence: e.confidence,
          breakdown: {
            initialization: formatMs(e.breakdown.initialization),
            moduleLoading: formatMs(e.breakdown.moduleLoading),
            awsSdkInit: formatMs(e.breakdown.awsSdkInit),
            connectionSetup: formatMs(e.breakdown.connectionSetup)
          },
          factors: {
            bundleSizeMb: (e.factors.bundleSize / (1024 * 1024)).toFixed(2),
            importDepth: e.factors.importDepth,
            awsSdkClients: e.factors.awsSdkClients,
            hasDbConnection: e.factors.databaseConnections > 0
          }
        })),
        slowest: slow.slice(0, 5).map((e) => e.lambda),
        note: 'Estimates are heuristic-based. Actual cold starts may vary based on AWS conditions.'
      }
    }

    case 'compare': {
      if (!lambda) {
        return {error: 'Lambda name required for compare query', example: {query: 'compare', lambda: 'ListFiles'}}
      }

      // Compare different memory configurations
      const memoryConfigs = [128, 256, 512, 1024, 2048, 3072]
      const comparisons: Array<{memory: number; estimate: ColdStartEstimate}> = []

      for (const mem of memoryConfigs) {
        const estimate = await estimateColdStart(lambda, mem)
        comparisons.push({memory: mem, estimate})
      }

      // Find optimal memory
      const costWeighted = comparisons.map((c) => ({
        memory: c.memory,
        coldStart: c.estimate.estimatedMs,
        // Cost factor: higher memory = higher cost per ms
        costFactor: c.memory / 1024,
        // Efficiency: cold start reduction per dollar
        efficiency: (comparisons[0].estimate.estimatedMs - c.estimate.estimatedMs) / (c.memory / 128)
      }))

      const optimal = costWeighted.reduce((best, current) => (current.efficiency > best.efficiency ? current : best))

      return {
        lambda,
        comparison: comparisons.map((c) => ({
          memory: `${c.memory}MB`,
          estimated: formatMs(c.estimate.estimatedMs),
          estimatedMs: c.estimate.estimatedMs,
          relativeTo1024: `${
            Math.round((c.estimate.estimatedMs / comparisons.find((x) => x.memory === 1024)!.estimate.estimatedMs) * 100)
          }%`
        })),
        recommendation: {
          optimalMemory: `${optimal.memory}MB`,
          reason: optimal.memory === 128
            ? 'Cold start is already fast enough at minimum memory'
            : `Best balance of cold start reduction (${
              formatMs(comparisons[0].estimate.estimatedMs - comparisons.find((c) => c.memory === optimal.memory)!.estimate.estimatedMs)
            } savings) vs cost`,
          estimatedColdStart: formatMs(comparisons.find((c) => c.memory === optimal.memory)!.estimate.estimatedMs)
        }
      }
    }

    case 'optimize': {
      if (!lambda) {
        return {error: 'Lambda name required for optimize query', example: {query: 'optimize', lambda: 'ListFiles'}}
      }

      const estimate = await estimateColdStart(lambda, memory)
      const recommendations = getOptimizationRecommendations(estimate, memory)

      // Calculate potential total improvement
      let potentialImprovement = 0
      if (estimate.factors.bundleSize > 5 * 1024 * 1024) {
        potentialImprovement += estimate.estimatedMs * 0.3
      }
      if (estimate.factors.awsSdkClients > 3) {
        potentialImprovement += estimate.factors.awsSdkClients * 40
      }
      if (memory < 512) {
        potentialImprovement += estimate.estimatedMs * 0.3
      }

      return {
        lambda,
        currentEstimate: formatMs(estimate.estimatedMs),
        memory: `${memory}MB`,
        potentialImprovement: formatMs(Math.round(potentialImprovement)),
        optimizedEstimate: formatMs(Math.round(estimate.estimatedMs - potentialImprovement)),
        recommendations,
        actionPlan: recommendations.length > 0
          ? recommendations.slice(0, 3).map((r, i) => `${i + 1}. [${r.impact.toUpperCase()}] ${r.recommendation}`)
          : ['No significant optimizations identified - cold start is already optimized']
      }
    }

    default:
      return {
        error: `Unknown query type: ${query}`,
        availableQueries: ['estimate', 'compare', 'optimize'],
        examples: [
          {query: 'estimate'},
          {query: 'estimate', lambda: 'ListFiles', memory: 512},
          {query: 'compare', lambda: 'WebhookFeedly'},
          {query: 'optimize', lambda: 'StartFileUpload', memory: 256}
        ]
      }
  }
}
