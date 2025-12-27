/**
 * Impact analysis handler for MCP server
 * Shows what's affected by changing a Lambda function or shared module
 *
 * Uses build/graph.json for dependency analysis and metadata for Lambda info
 */

import {getLambdaInvocations, loadDependencyGraph, loadMetadata} from './data-loader.js'

export type ImpactQueryType = 'dependents' | 'cascade' | 'tests' | 'infrastructure' | 'all'

export interface ImpactQueryArgs {
  file: string
  query: ImpactQueryType
}

/**
 * Convert a file path to its corresponding test file path
 */
function getTestFilePath(filePath: string): string | null {
  // Lambda handler: src/lambdas/Name/src/index.ts -> src/lambdas/Name/test/index.test.ts
  if (filePath.includes('/lambdas/') && filePath.includes('/src/')) {
    return filePath.replace('/src/', '/test/').replace(/\.ts$/, '.test.ts')
  }

  // Entity: src/entities/Name.ts -> could have tests in multiple places
  if (filePath.includes('/entities/')) {
    return null // Entities are tested via Lambda tests
  }

  // Utility: src/util/name.ts -> test/util/name.test.ts or src/util/name.test.ts
  if (filePath.includes('/util/')) {
    const testPath = filePath.replace('/util/', '/test/util/').replace(/\.ts$/, '.test.ts')
    return testPath
  }

  return null
}

/**
 * Extract Lambda name from a file path
 */
function extractLambdaName(filePath: string): string | null {
  const match = filePath.match(/src\/lambdas\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Find all files that import a given file (reverse dependency lookup)
 */
function findDependents(filePath: string, graph: Record<string, {imports: string[]}>): string[] {
  const dependents: string[] = []
  for (const [file, data] of Object.entries(graph)) {
    if (data.imports?.includes(filePath)) {
      dependents.push(file)
    }
  }
  return dependents.sort()
}

/**
 * Recursively find all files affected by changing a file
 */
function findCascade(filePath: string, graph: Record<string, {imports: string[]}>): string[] {
  const affected = new Set<string>()
  const toProcess = [filePath]

  while (toProcess.length > 0) {
    const current = toProcess.pop()!
    const dependents = findDependents(current, graph)

    for (const dep of dependents) {
      if (!affected.has(dep)) {
        affected.add(dep)
        toProcess.push(dep)
      }
    }
  }

  return Array.from(affected).sort()
}

/** Handles MCP queries for dependency impact and affected components. */
export async function handleImpactQuery(args: ImpactQueryArgs) {
  const {file, query} = args

  if (!file) {
    return {error: 'File path required', example: {file: 'src/entities/Files.ts', query: 'dependents'}}
  }

  // Load data
  const [depGraph, metadata, invocations] = await Promise.all([loadDependencyGraph(), loadMetadata(), getLambdaInvocations()])

  // Normalize file path
  const normalizedFile = file.startsWith('src/') ? file : `src/${file}`

  // Check if file exists in graph
  const fileExists = Object.keys(depGraph.files).some((f) => f === normalizedFile || f.includes(file))
  if (!fileExists) {
    const suggestions = Object.keys(depGraph.files).filter((f) => f.includes(file.split('/').pop()!.replace('.ts', ''))).slice(0, 5)

    return {
      error: `File '${file}' not found in dependency graph`,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      hint: 'Use relative path from project root (e.g., src/entities/Files.ts)'
    }
  }

  switch (query) {
    case 'dependents': {
      // Find direct dependents
      const dependents = findDependents(normalizedFile, depGraph.files)

      // Categorize dependents
      const lambdaDependents = dependents.filter((d) => d.includes('/lambdas/'))
      const entityDependents = dependents.filter((d) => d.includes('/entities/'))
      const utilDependents = dependents.filter((d) => d.includes('/util/'))
      const otherDependents = dependents.filter((d) => !lambdaDependents.includes(d) && !entityDependents.includes(d) && !utilDependents.includes(d))

      return {
        file: normalizedFile,
        directDependents: {
          lambdas: lambdaDependents.map((d) => ({file: d, name: extractLambdaName(d)})),
          entities: entityDependents,
          utilities: utilDependents,
          other: otherDependents
        },
        totalCount: dependents.length
      }
    }

    case 'cascade': {
      // Find full cascade of affected files
      const cascade = findCascade(normalizedFile, depGraph.files)

      // Categorize by type
      const affectedLambdas = new Set<string>()
      const affectedTests: string[] = []
      const affectedOther: string[] = []

      for (const f of cascade) {
        const lambdaName = extractLambdaName(f)
        if (lambdaName) {
          affectedLambdas.add(lambdaName)
        }
        if (f.includes('.test.') || f.includes('/test/')) {
          affectedTests.push(f)
        }
        if (!f.includes('/lambdas/') && !f.includes('.test.')) {
          affectedOther.push(f)
        }
      }

      return {
        file: normalizedFile,
        cascade: {totalFiles: cascade.length, lambdas: Array.from(affectedLambdas).sort(), tests: affectedTests, other: affectedOther},
        recommendation: affectedLambdas.size > 0
          ? `Run tests for affected Lambdas: ${Array.from(affectedLambdas).join(', ')}`
          : 'No Lambda functions directly affected'
      }
    }

    case 'tests': {
      // Find test files that need updating
      const cascade = findCascade(normalizedFile, depGraph.files)

      const testFiles: Array<{testFile: string; sourceFile: string; exists: boolean}> = []
      const processedSources = new Set<string>()

      // Add test for the changed file itself
      const mainTestFile = getTestFilePath(normalizedFile)
      if (mainTestFile) {
        testFiles.push({testFile: mainTestFile, sourceFile: normalizedFile, exists: true})
      }

      // Add tests for affected files
      for (const f of cascade) {
        if (f.includes('.test.') || f.includes('/test/')) {
          // This is already a test file
          testFiles.push({testFile: f, sourceFile: f.replace('.test.ts', '.ts').replace('/test/', '/src/'), exists: true})
        } else if (!processedSources.has(f)) {
          const testPath = getTestFilePath(f)
          if (testPath) {
            testFiles.push({testFile: testPath, sourceFile: f, exists: true})
            processedSources.add(f)
          }
        }
      }

      // Group by Lambda
      const testsByLambda: Record<string, string[]> = {}
      for (const t of testFiles) {
        const lambdaName = extractLambdaName(t.testFile)
        if (lambdaName) {
          if (!testsByLambda[lambdaName]) {
            testsByLambda[lambdaName] = []
          }
          if (!testsByLambda[lambdaName].includes(t.testFile)) {
            testsByLambda[lambdaName].push(t.testFile)
          }
        }
      }

      return {
        file: normalizedFile,
        testsToUpdate: testFiles.map((t) => t.testFile),
        byLambda: testsByLambda,
        testCommand: Object.keys(testsByLambda).length > 0 ? `pnpm test -- --testPathPattern="${Object.keys(testsByLambda).join('|')}"` : 'pnpm test'
      }
    }

    case 'infrastructure': {
      // Find related Terraform files
      const cascade = findCascade(normalizedFile, depGraph.files)

      // Extract Lambda names from affected files
      const affectedLambdas = new Set<string>()
      const lambdaName = extractLambdaName(normalizedFile)
      if (lambdaName) {
        affectedLambdas.add(lambdaName)
      }

      for (const f of cascade) {
        const name = extractLambdaName(f)
        if (name) {
          affectedLambdas.add(name)
        }
      }

      // Map to Terraform files
      const terraformFiles = Array.from(affectedLambdas).map((name) => ({
        lambda: name,
        terraformFile: `terraform/${name.toLowerCase()}.tf`,
        trigger: metadata.lambdas[name]?.trigger || 'Unknown'
      }))

      // Check for Lambda invocations
      const affectedInvocations = invocations.filter((inv) => affectedLambdas.has(inv.from) || affectedLambdas.has(inv.to))

      return {
        file: normalizedFile,
        affectedLambdas: Array.from(affectedLambdas),
        terraformFiles,
        invocationChains: affectedInvocations,
        recommendation: terraformFiles.length > 0
          ? `Review Terraform files: ${terraformFiles.map((t) => t.terraformFile).join(', ')}`
          : 'No infrastructure changes expected'
      }
    }

    case 'all': {
      // Comprehensive impact analysis
      const cascade = findCascade(normalizedFile, depGraph.files)
      const directDependents = findDependents(normalizedFile, depGraph.files)

      // Extract affected Lambdas
      const affectedLambdas = new Set<string>()
      const lambdaName = extractLambdaName(normalizedFile)
      if (lambdaName) {
        affectedLambdas.add(lambdaName)
      }

      for (const f of [...cascade, ...directDependents]) {
        const name = extractLambdaName(f)
        if (name) {
          affectedLambdas.add(name)
        }
      }

      // Determine severity
      let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      if (normalizedFile.includes('/entities/')) {
        severity = 'HIGH' // Entity changes affect multiple Lambdas
      } else if (normalizedFile.includes('/util/lambda-helpers') || normalizedFile.includes('/util/errors')) {
        severity = 'CRITICAL' // Core utility changes
      } else if (affectedLambdas.size > 3) {
        severity = 'HIGH'
      } else if (affectedLambdas.size > 0) {
        severity = 'MEDIUM'
      } else {
        severity = 'LOW'
      }

      return {
        file: normalizedFile,
        severity,
        impact: {
          directDependents: directDependents.length,
          cascadeFiles: cascade.length,
          affectedLambdas: Array.from(affectedLambdas).sort(),
          lambdaCount: affectedLambdas.size
        },
        tests: {
          command: affectedLambdas.size > 0 ? `pnpm test -- --testPathPattern="${Array.from(affectedLambdas).join('|')}"` : 'pnpm test',
          fullSuiteRecommended: severity === 'CRITICAL' || severity === 'HIGH'
        },
        infrastructure: {
          terraformFiles: Array.from(affectedLambdas).map((name) => `terraform/${name.toLowerCase()}.tf`),
          invocations: invocations.filter((inv) => affectedLambdas.has(inv.from) || affectedLambdas.has(inv.to))
        },
        recommendation: severity === 'CRITICAL'
          ? 'CRITICAL change: Run full test suite and review all affected Lambdas'
          : severity === 'HIGH'
          ? 'HIGH impact: Run affected Lambda tests and verify functionality'
          : severity === 'MEDIUM'
          ? 'MEDIUM impact: Run targeted tests for affected Lambdas'
          : 'LOW impact: Standard testing should suffice'
      }
    }

    default:
      return {
        error: `Unknown query: ${query}`,
        availableQueries: ['dependents', 'cascade', 'tests', 'infrastructure', 'all'],
        examples: [
          {file: 'src/entities/Files.ts', query: 'dependents'},
          {file: 'src/entities/Files.ts', query: 'cascade'},
          {file: 'src/lambdas/ListFiles/src/index.ts', query: 'tests'},
          {file: 'src/util/lambda-helpers.ts', query: 'all'}
        ]
      }
  }
}
