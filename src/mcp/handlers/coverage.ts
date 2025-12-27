/**
 * Coverage analysis handler for MCP server
 * Analyzes which dependencies need mocking for Jest tests
 *
 * Uses build/graph.json for transitive dependency analysis
 */

import fs from 'fs/promises'
import path from 'path'
import {discoverEntities, loadDependencyGraph} from './data-loader.js'

export type CoverageQueryType = 'required' | 'missing' | 'all' | 'summary'

export interface CoverageQueryArgs {
  file: string
  query: CoverageQueryType
}

interface MockCategory {
  entities: Array<{name: string; path: string; mockHelper: string}>
  vendors: Array<{name: string; path: string; exports?: string[]}>
  external: Array<{name: string; suggestion: string}>
  utilities: Array<{path: string; needsMock: boolean; reason?: string}>
}

/**
 * Categorize a dependency for mocking purposes
 */
function categorizeDependency(dep: string, entityNames: string[]): {category: keyof MockCategory; name: string; details: Record<string, unknown>} | null {
  // Entity files
  const entityMatch = dep.match(/src\/entities\/(\w+)/)
  if (entityMatch) {
    const entityName = entityMatch[1]
    if (entityNames.includes(entityName)) {
      return {category: 'entities', name: entityName, details: {path: dep, mockHelper: 'createEntityMock()'}}
    }
  }

  // AWS Vendor wrappers
  const awsVendorMatch = dep.match(/src\/lib\/vendor\/AWS\/(\w+)/)
  if (awsVendorMatch) {
    return {category: 'vendors', name: `AWS/${awsVendorMatch[1]}`, details: {path: dep}}
  }

  // Other vendor wrappers
  const vendorMatch = dep.match(/src\/lib\/vendor\/(\w+)/)
  if (vendorMatch && !dep.includes('/AWS/')) {
    return {category: 'vendors', name: vendorMatch[1], details: {path: dep}}
  }

  // Utilities that typically need mocking
  const utilsNeedingMocks = ['lambda-helpers', 'logging', 'errors', 'env-validation']
  const utilMatch = dep.match(/src\/util\/(\w+[-\w]*)/)
  if (utilMatch) {
    const utilName = utilMatch[1]
    const needsMock = utilsNeedingMocks.some((u) => utilName.includes(u))
    return {
      category: 'utilities',
      name: utilName,
      details: {path: dep, needsMock, reason: needsMock ? 'Contains external dependencies or environment access' : undefined}
    }
  }

  return null
}

/**
 * Analyze an existing test file for current mocks
 */
async function analyzeExistingTestMocks(testFilePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(testFilePath, 'utf-8')
    const mocks: string[] = []

    // Find jest.unstable_mockModule calls
    const mockModulePattern = /jest\.unstable_mockModule\s*\(\s*['"]([^'"]+)['"]/g
    let match
    while ((match = mockModulePattern.exec(content)) !== null) {
      mocks.push(match[1])
    }

    // Find jest.mock calls
    const jestMockPattern = /jest\.mock\s*\(\s*['"]([^'"]+)['"]/g
    while ((match = jestMockPattern.exec(content)) !== null) {
      mocks.push(match[1])
    }

    return mocks
  } catch {
    return []
  }
}

/**
 * Convert file path to test file path
 */
function getTestFilePath(filePath: string): string {
  // src/lambdas/Name/src/index.ts -> src/lambdas/Name/test/index.test.ts
  return filePath.replace('/src/', '/test/').replace(/\.ts$/, '.test.ts')
}

/** */
export async function handleCoverageQuery(args: CoverageQueryArgs) {
  const {file, query} = args

  if (!file) {
    return {error: 'File path required', example: {file: 'src/lambdas/ListFiles/src/index.ts', query: 'required'}}
  }

  // Load dependency graph and entity names
  const [depGraph, entityNames] = await Promise.all([loadDependencyGraph(), discoverEntities()])

  // Get transitive dependencies for the file
  const transitiveDeps = depGraph.transitiveDependencies[file] || []

  if (transitiveDeps.length === 0) {
    // Try to find the file in the graph with different path formats
    const possiblePaths = Object.keys(depGraph.transitiveDependencies).filter((k) => k.includes(file) || file.includes(k))

    if (possiblePaths.length > 0) {
      return {error: `File not found exactly as '${file}'. Did you mean one of these?`, suggestions: possiblePaths.slice(0, 5)}
    }

    return {
      error: `File '${file}' not found in dependency graph`,
      hint: 'Make sure the file path is relative to project root (e.g., src/lambdas/ListFiles/src/index.ts)',
      availableFiles: Object.keys(depGraph.transitiveDependencies).filter((k) => k.includes('lambdas')).slice(0, 10)
    }
  }

  // Categorize all dependencies
  const mockAnalysis: MockCategory = {entities: [], vendors: [], external: [], utilities: []}

  for (const dep of transitiveDeps) {
    const categorized = categorizeDependency(dep, entityNames)
    if (categorized) {
      const {category, name, details} = categorized
      if (category === 'entities') {
        mockAnalysis.entities.push({name, path: details.path as string, mockHelper: details.mockHelper as string})
      } else if (category === 'vendors') {
        mockAnalysis.vendors.push({name, path: details.path as string})
      } else if (category === 'utilities') {
        mockAnalysis.utilities.push({path: details.path as string, needsMock: details.needsMock as boolean, reason: details.reason as string | undefined})
      }
    }
  }

  switch (query) {
    case 'required': {
      // Return what needs to be mocked
      return {
        file,
        transitiveDependencyCount: transitiveDeps.length,
        mockingRequired: {entities: mockAnalysis.entities, vendors: mockAnalysis.vendors, utilities: mockAnalysis.utilities.filter((u) => u.needsMock)},
        mockingOptional: {utilities: mockAnalysis.utilities.filter((u) => !u.needsMock)},
        recommendation: `Mock ${mockAnalysis.entities.length} entities and ${mockAnalysis.vendors.length} vendors before importing the handler`
      }
    }

    case 'missing': {
      // Compare against existing test file
      const testFile = getTestFilePath(file)
      const existingMocks = await analyzeExistingTestMocks(path.join(process.cwd(), testFile))

      // Find missing mocks
      const requiredPaths = [...mockAnalysis.entities.map((e) => e.path), ...mockAnalysis.vendors.map((v) => v.path)]

      const missingMocks = requiredPaths.filter((reqPath) => {
        // Check if any existing mock matches this path
        return !existingMocks.some((mock) => reqPath.includes(mock.replace('#', 'src/').replace(/\//g, '/')) || mock.includes(reqPath.split('/').pop()!))
      })

      return {
        file,
        testFile,
        existingMocks,
        missingMocks,
        coverage: existingMocks.length > 0 ? `${Math.round((1 - missingMocks.length / requiredPaths.length) * 100)}%` : 'No test file found'
      }
    }

    case 'all': {
      // Full analysis
      const testFile = getTestFilePath(file)
      const existingMocks = await analyzeExistingTestMocks(path.join(process.cwd(), testFile))

      return {
        file,
        testFile,
        transitiveDependencies: transitiveDeps,
        analysis: mockAnalysis,
        existingMocks,
        summary: {
          totalDependencies: transitiveDeps.length,
          entities: mockAnalysis.entities.length,
          vendors: mockAnalysis.vendors.length,
          utilitiesNeedingMocks: mockAnalysis.utilities.filter((u) => u.needsMock).length
        }
      }
    }

    case 'summary': {
      return {
        file,
        dependencies: transitiveDeps.length,
        entities: mockAnalysis.entities.map((e) => e.name),
        vendors: mockAnalysis.vendors.map((v) => v.name),
        recommendation: mockAnalysis.entities.length > 0
          ? 'Use createEntityMock() from test/helpers/entity-mock.ts for entity mocking'
          : 'Standard jest.unstable_mockModule() for vendor mocks'
      }
    }

    default:
      return {
        error: `Unknown query: ${query}`,
        availableQueries: ['required', 'missing', 'all', 'summary'],
        examples: [
          {file: 'src/lambdas/ListFiles/src/index.ts', query: 'required'},
          {file: 'src/lambdas/ListFiles/src/index.ts', query: 'missing'},
          {file: 'src/lambdas/ListFiles/src/index.ts', query: 'all'}
        ]
      }
  }
}
