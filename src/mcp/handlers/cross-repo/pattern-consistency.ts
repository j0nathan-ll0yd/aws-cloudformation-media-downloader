/**
 * Pattern consistency analyzer for MCP server
 * Detects pattern drift across the codebase
 *
 * Features:
 * - Scan for pattern implementations
 * - Compare patterns across locations
 * - Identify deviations from canonical patterns
 */

import {Project, SourceFile, SyntaxKind} from 'ts-morph'
import path from 'path'
import {fileURLToPath} from 'url'
import {handleValidationQuery} from '../validation.js'
import {discoverLambdas} from '../data-loader.js'
import {createErrorResponse, createSuccessResponse} from '../shared/response-types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../..')

export type PatternQueryType = 'scan' | 'compare' | 'drift'

export interface PatternConsistencyArgs {
  query: PatternQueryType
  pattern?: string
  paths?: string[]
  referenceImpl?: string
}

interface PatternMatch {
  file: string
  line: number
  pattern: string
  implementation: string
  matchScore: number
}

interface PatternDrift {
  file: string
  pattern: string
  issue: string
  reference?: string
  severity: 'low' | 'medium' | 'high'
}

// Known patterns and their detection rules
const PATTERN_DEFINITIONS: Record<
  string,
  {name: string; description: string; detect: (sourceFile: SourceFile) => PatternMatch[]; referenceFile?: string}
> = {
  'error-handling': {
    name: 'Error Handling Pattern',
    description: 'Lambda error response pattern using buildApiResponse',
    detect: (sourceFile) => {
      const matches: PatternMatch[] = []
      const filePath = sourceFile.getFilePath()

      // Look for try-catch blocks with error responses
      const tryCatches = sourceFile.getDescendantsOfKind(SyntaxKind.TryStatement)
      for (const tc of tryCatches) {
        const catchClause = tc.getCatchClause()
        if (catchClause) {
          const catchBlock = catchClause.getBlock().getText()
          const usesBuildApiResponse = catchBlock.includes('buildApiResponse')
          const usesRawResponse = catchBlock.includes('statusCode') && catchBlock.includes('body')

          matches.push({
            file: path.relative(projectRoot, filePath),
            line: tc.getStartLineNumber(),
            pattern: 'error-handling',
            implementation: usesBuildApiResponse ? 'buildApiResponse' : usesRawResponse ? 'raw-response' : 'unknown',
            matchScore: usesBuildApiResponse ? 100 : usesRawResponse ? 50 : 0
          })
        }
      }
      return matches
    },
    referenceFile: 'src/lambdas/ListFiles/src/index.ts'
  },

  'entity-access': {
    name: 'Entity Access Pattern',
    description: 'Drizzle entity access via query functions',
    detect: (sourceFile) => {
      const matches: PatternMatch[] = []
      const filePath = sourceFile.getFilePath()

      // Look for entity imports
      const imports = sourceFile.getImportDeclarations()
      for (const imp of imports) {
        const moduleSpec = imp.getModuleSpecifierValue()
        if (moduleSpec.includes('#entities/')) {
          const namedImports = imp.getNamedImports().map((n) => n.getName())
          matches.push({
            file: path.relative(projectRoot, filePath),
            line: imp.getStartLineNumber(),
            pattern: 'entity-access',
            implementation: `imports: ${namedImports.join(', ')}`,
            matchScore: 100
          })
        }
      }
      return matches
    }
  },

  'aws-vendor': {
    name: 'AWS Vendor Pattern',
    description: 'AWS SDK access via vendor wrapper',
    detect: (sourceFile) => {
      const matches: PatternMatch[] = []
      const filePath = sourceFile.getFilePath()

      const imports = sourceFile.getImportDeclarations()
      for (const imp of imports) {
        const moduleSpec = imp.getModuleSpecifierValue()
        if (moduleSpec.includes('#lib/vendor/AWS/')) {
          matches.push({
            file: path.relative(projectRoot, filePath),
            line: imp.getStartLineNumber(),
            pattern: 'aws-vendor',
            implementation: 'vendor-wrapper',
            matchScore: 100
          })
        } else if (moduleSpec.startsWith('@aws-sdk/')) {
          matches.push({
            file: path.relative(projectRoot, filePath),
            line: imp.getStartLineNumber(),
            pattern: 'aws-vendor',
            implementation: 'direct-sdk',
            matchScore: 0
          })
        }
      }
      return matches
    }
  },

  'env-access': {
    name: 'Environment Variable Access',
    description: 'Environment variable access via getRequiredEnv',
    detect: (sourceFile) => {
      const matches: PatternMatch[] = []
      const filePath = sourceFile.getFilePath()
      const text = sourceFile.getFullText()

      // Check for process.env direct access
      const processEnvMatches = text.match(/process\.env\.\w+/g) || []
      const getRequiredEnvMatches = text.match(/getRequiredEnv\s*\(/g) || []

      if (processEnvMatches.length > 0) {
        matches.push({
          file: path.relative(projectRoot, filePath),
          line: 1,
          pattern: 'env-access',
          implementation: `direct process.env (${processEnvMatches.length} occurrences)`,
          matchScore: 0
        })
      }

      if (getRequiredEnvMatches.length > 0) {
        matches.push({
          file: path.relative(projectRoot, filePath),
          line: 1,
          pattern: 'env-access',
          implementation: `getRequiredEnv (${getRequiredEnvMatches.length} occurrences)`,
          matchScore: 100
        })
      }

      return matches
    }
  },

  'handler-export': {
    name: 'Handler Export Pattern',
    description: 'Lambda handler export pattern',
    detect: (sourceFile) => {
      const matches: PatternMatch[] = []
      const filePath = sourceFile.getFilePath()

      // Look for handler exports
      const exports = sourceFile.getExportedDeclarations()
      for (const [name, decls] of exports) {
        if (name === 'handler') {
          for (const decl of decls) {
            const text = decl.getText()
            const usesWrapper = text.includes('withPowertools') || text.includes('wrapLambdaInvokeHandler')

            matches.push({
              file: path.relative(projectRoot, filePath),
              line: decl.getStartLineNumber(),
              pattern: 'handler-export',
              implementation: usesWrapper ? 'wrapped' : 'unwrapped',
              matchScore: usesWrapper ? 100 : 50
            })
          }
        }
      }
      return matches
    }
  }
}

/**
 * Scan for pattern implementations across the codebase
 */
async function scanPatterns(patternName: string | undefined, paths?: string[]): Promise<Record<string, PatternMatch[]>> {
  const project = new Project({tsConfigFilePath: path.join(projectRoot, 'tsconfig.json')})
  const results: Record<string, PatternMatch[]> = {}

  // Get source files
  let sourceFiles = project.getSourceFiles()

  // Filter by paths if provided
  if (paths && paths.length > 0) {
    sourceFiles = sourceFiles.filter((sf) => {
      const filePath = path.relative(projectRoot, sf.getFilePath())
      return paths.some((p) => filePath.includes(p))
    })
  }

  // Filter to Lambda handlers by default
  sourceFiles = sourceFiles.filter((sf) => {
    const filePath = sf.getFilePath()
    return filePath.includes('/lambdas/') && filePath.endsWith('/src/index.ts')
  })

  // Get patterns to scan
  const patternsToScan = patternName ? {[patternName]: PATTERN_DEFINITIONS[patternName]} : PATTERN_DEFINITIONS

  for (const [name, def] of Object.entries(patternsToScan)) {
    if (!def) {
      continue
    }

    const matches: PatternMatch[] = []
    for (const sourceFile of sourceFiles) {
      const fileMatches = def.detect(sourceFile)
      matches.push(...fileMatches)
    }
    results[name] = matches
  }

  return results
}

/**
 * Compare patterns across locations
 */
async function comparePatterns(
  patternName: string,
  referenceImpl?: string
): Promise<{reference: PatternMatch | null; implementations: PatternMatch[]; comparison: {consistent: number; inconsistent: number}}> {
  const project = new Project({tsConfigFilePath: path.join(projectRoot, 'tsconfig.json')})
  const def = PATTERN_DEFINITIONS[patternName]

  if (!def) {
    return {reference: null, implementations: [], comparison: {consistent: 0, inconsistent: 0}}
  }

  // Get reference implementation
  let reference: PatternMatch | null = null
  const refPath = referenceImpl || def.referenceFile

  if (refPath) {
    const refFile = project.getSourceFile(path.join(projectRoot, refPath))
    if (refFile) {
      const refMatches = def.detect(refFile)
      reference = refMatches[0] || null
    }
  }

  // Get all implementations
  const allResults = await scanPatterns(patternName)
  const implementations = allResults[patternName] || []

  // Compare against reference
  let consistent = 0
  let inconsistent = 0

  if (reference) {
    for (const impl of implementations) {
      if (impl.implementation === reference.implementation) {
        consistent++
      } else {
        inconsistent++
      }
    }
  }

  return {reference, implementations, comparison: {consistent, inconsistent}}
}

/**
 * Detect pattern drift
 */
async function detectDrift(patternName?: string, paths?: string[]): Promise<PatternDrift[]> {
  const drifts: PatternDrift[] = []

  // Get validation violations as drift indicators by validating Lambda files
  const lambdas = await discoverLambdas()

  for (const lambda of lambdas) {
    const filePath = `src/lambdas/${lambda}/src/index.ts`

    // Filter by paths if provided
    if (paths && paths.length > 0 && !paths.some((p) => filePath.includes(p))) {
      continue
    }

    const validationResult = await handleValidationQuery({query: 'all', file: filePath})

    if ('violations' in validationResult && Array.isArray(validationResult.violations)) {
      for (const violation of validationResult.violations) {
        // Map validation rules to patterns
        let pattern = ''
        if (violation.rule === 'aws-sdk-encapsulation') {
          pattern = 'aws-vendor'
        } else if (violation.rule === 'env-validation') {
          pattern = 'env-access'
        } else if (violation.rule === 'response-helpers') {
          pattern = 'error-handling'
        } else if (violation.rule === 'entity-mocking') {
          pattern = 'entity-access'
        }

        if (pattern && (!patternName || pattern === patternName)) {
          drifts.push({
            file: filePath,
            pattern,
            issue: violation.message,
            severity: violation.severity === 'CRITICAL' ? 'high' : violation.severity === 'HIGH' ? 'medium' : 'low'
          })
        }
      }
    }
  }

  // Additional drift detection from pattern scans
  const scanResults = await scanPatterns(patternName, paths)

  for (const [pattern, matches] of Object.entries(scanResults)) {
    // Find low-scoring implementations
    for (const match of matches) {
      if (match.matchScore < 50) {
        drifts.push({
          file: match.file,
          pattern,
          issue: `Non-standard implementation: ${match.implementation}`,
          severity: match.matchScore === 0 ? 'high' : 'medium'
        })
      }
    }
  }

  return drifts
}

/**
 * Main handler for pattern consistency queries
 */
export async function handlePatternConsistencyQuery(args: PatternConsistencyArgs) {
  const {query, pattern, paths, referenceImpl} = args
  switch (query) {
    case 'scan': {
      const results = await scanPatterns(pattern, paths)

      // Calculate summary
      const summary: Record<string, {total: number; implementations: Record<string, number>}> = {}
      for (const [patternName, matches] of Object.entries(results)) {
        const implCounts: Record<string, number> = {}
        for (const match of matches) {
          implCounts[match.implementation] = (implCounts[match.implementation] || 0) + 1
        }
        summary[patternName] = {total: matches.length, implementations: implCounts}
      }

      return createSuccessResponse({
        patterns: Object.keys(results),
        totalMatches: Object.values(results).reduce((sum, m) => sum + m.length, 0),
        summary,
        details: results
      })
    }

    case 'compare': {
      if (!pattern) {
        return createErrorResponse('Pattern name required for compare query', `Available patterns: ${Object.keys(PATTERN_DEFINITIONS).join(', ')}`)
      }

      const comparison = await comparePatterns(pattern, referenceImpl)

      return createSuccessResponse({
        pattern,
        reference: comparison.reference,
        totalImplementations: comparison.implementations.length,
        consistency: {
          consistent: comparison.comparison.consistent,
          inconsistent: comparison.comparison.inconsistent,
          percentConsistent: comparison.implementations.length > 0
            ? Math.round((comparison.comparison.consistent / comparison.implementations.length) * 100)
            : 100
        },
        implementations: comparison.implementations
      })
    }

    case 'drift': {
      const drifts = await detectDrift(pattern, paths)

      // Group by pattern
      const byPattern: Record<string, PatternDrift[]> = {}
      for (const drift of drifts) {
        if (!byPattern[drift.pattern]) {
          byPattern[drift.pattern] = []
        }
        byPattern[drift.pattern].push(drift)
      }

      // Calculate severity distribution
      const bySeverity = {
        high: drifts.filter((d) => d.severity === 'high').length,
        medium: drifts.filter((d) => d.severity === 'medium').length,
        low: drifts.filter((d) => d.severity === 'low').length
      }

      return createSuccessResponse({
        hasDrift: drifts.length > 0,
        totalDrifts: drifts.length,
        bySeverity,
        byPattern: Object.entries(byPattern).map(([p, d]) => ({pattern: p, count: d.length})),
        drifts: drifts.slice(0, 50), // Limit to 50 for readability
        recommendation: bySeverity.high > 0
          ? `CRITICAL: ${bySeverity.high} high-severity pattern drifts detected. Run migrations to fix.`
          : bySeverity.medium > 0
          ? `WARNING: ${bySeverity.medium} medium-severity pattern drifts. Consider standardizing.`
          : drifts.length > 0
          ? `INFO: ${drifts.length} minor pattern variations detected.`
          : 'All patterns are consistent.'
      })
    }

    default:
      return createErrorResponse(`Unknown query type: ${query}`, 'Available queries: scan, compare, drift')
  }
}
