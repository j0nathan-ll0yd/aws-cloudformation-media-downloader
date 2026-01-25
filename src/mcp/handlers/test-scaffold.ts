/**
 * Test scaffolding handler for MCP server
 * Generates complete test file scaffolding with all required mocks
 *
 * Uses build/graph.json for dependency analysis and existing test patterns.
 * Templates are loaded from external files in src/mcp/templates/test-scaffold/
 * to keep code clean and maintainable.
 */

import {discoverEntities, loadDependencyGraph} from './data-loader.js'
import {loadAndInterpolate, loadTemplate} from '../templates/loader.js'
import {createErrorResponse, createSuccessResponse} from './shared/response-types.js'

export type TestScaffoldQueryType = 'scaffold' | 'mocks' | 'fixtures' | 'structure'

export interface TestScaffoldQueryArgs {
  file: string
  query: TestScaffoldQueryType
}

interface MockInfo {
  type: 'entity' | 'vendor' | 'utility' | 'external'
  name: string
  path: string
  importAlias: string
  mockCode: string
}

/**
 * Extract Lambda name from file path
 */
function extractLambdaName(filePath: string): string | null {
  const match = filePath.match(/src\/lambdas\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Generate mock code for a dependency using templates
 */
function generateMockCode(dep: string, entityNames: string[]): MockInfo | null {
  // Entity mocks
  const entityMatch = dep.match(/src\/entities\/(\w+)/)
  if (entityMatch && entityNames.includes(entityMatch[1])) {
    const entityName = entityMatch[1]
    const mockCode = loadAndInterpolate('test-scaffold/entity-mock.template.txt', {entityName, entityNameLower: entityName.toLowerCase()})
    return {type: 'entity', name: entityName, path: dep, importAlias: `#entities/${entityName}`, mockCode}
  }

  // AWS Vendor mocks
  const awsVendorMatch = dep.match(/src\/lib\/vendor\/AWS\/(\w+)/)
  if (awsVendorMatch) {
    const serviceName = awsVendorMatch[1]
    const mockFunctions = getAwsServiceMocks(serviceName)
    const mockFunctionsStr = mockFunctions.map((fn) => `  ${fn}: vi.fn()`).join(',\n')
    const mockCode = loadAndInterpolate('test-scaffold/aws-vendor-mock.template.txt', {serviceName, mockFunctions: mockFunctionsStr})
    return {type: 'vendor', name: `AWS/${serviceName}`, path: dep, importAlias: `#lib/vendor/AWS/${serviceName}`, mockCode}
  }

  // Other vendor mocks (YouTube, etc.)
  const vendorMatch = dep.match(/src\/lib\/vendor\/(\w+)/)
  if (vendorMatch && !dep.includes('/AWS/')) {
    const vendorName = vendorMatch[1]
    const mockCode = loadAndInterpolate('test-scaffold/vendor-mock.template.txt', {vendorName})
    return {type: 'vendor', name: vendorName, path: dep, importAlias: `#lib/vendor/${vendorName}`, mockCode}
  }

  // OpenTelemetry wrapper
  if (dep.includes('OpenTelemetry')) {
    const mockCode = loadTemplate('test-scaffold/opentelemetry-mock.template.txt')
    return {type: 'vendor', name: 'OpenTelemetry', path: dep, importAlias: '#lib/vendor/OpenTelemetry', mockCode}
  }

  return null
}

/**
 * Get common mock functions for AWS services
 */
function getAwsServiceMocks(service: string): string[] {
  const serviceMocks: Record<string, string[]> = {
    DynamoDB: ['queryItems', 'getItem', 'putItem', 'deleteItem', 'batchGetItems', 'batchWriteItems'],
    S3: ['uploadToS3', 'getObject', 'deleteObject', 'listObjects'],
    Lambda: ['invokeFunction', 'invokeFunctionAsync'],
    SNS: ['publishToSNS', 'sendPushNotification'],
    SQS: ['sendMessage', 'receiveMessage', 'deleteMessage']
  }
  return serviceMocks[service] || ['mockFunction']
}

/**
 * Generate complete test file scaffold using templates
 */
function generateTestScaffold(lambdaName: string, mocks: MockInfo[]): string {
  const entityMocks = mocks.filter((m) => m.type === 'entity')
  const vendorMocks = mocks.filter((m) => m.type === 'vendor')

  // Build entity mock import (uses vi.mock pattern)
  const entityMockImport = entityMocks.length > 0 ? "import {vi} from 'vitest'" : ''

  // Build entity mocks section
  const entityMocksSection = entityMocks.length > 0 ? '// Entity mocks\n' + entityMocks.map((m) => m.mockCode).join('\n\n') + '\n' : ''

  // Build vendor mocks section
  const vendorMocksSection = vendorMocks.length > 0 ? '// Vendor mocks\n' + vendorMocks.map((m) => m.mockCode).join('\n\n') + '\n' : ''

  // Build entity mock resets
  const entityMockResets = entityMocks.length > 0 ? '    vi.clearAllMocks()' : ''

  // Build entity mock returns
  const entityMockReturns = entityMocks.length > 0
    ? entityMocks.map((m) => `      ${m.name.toLowerCase()}Mock.query.go.mockResolvedValue({data: []})`).join('\n') + '\n'
    : ''

  // Load and interpolate the main template
  return loadAndInterpolate('test-scaffold/test-file.template.txt', {
    lambdaName,
    entityMockImport,
    entityMocks: entityMocksSection,
    vendorMocks: vendorMocksSection,
    entityMockResets,
    entityMockReturns
  })
}

/** Handles MCP queries for generating test scaffolds and mock templates. */
export async function handleTestScaffoldQuery(args: TestScaffoldQueryArgs) {
  const {file, query} = args

  if (!file) {
    return createErrorResponse('File path required', 'Example: {file: "src/lambdas/ListFiles/src/index.ts", query: "scaffold"}')
  }

  // Load data
  const [depGraph, entityNames] = await Promise.all([loadDependencyGraph(), discoverEntities()])

  // Normalize file path
  const normalizedFile = file.startsWith('src/') ? file : `src/${file}`

  // Get transitive dependencies
  const transitiveDeps = depGraph.transitiveDependencies[normalizedFile] || []

  if (transitiveDeps.length === 0) {
    const suggestions = Object.keys(depGraph.transitiveDependencies).filter((k) => k.includes(file.split('/').pop()!.replace('.ts', ''))).slice(0, 5)

    return createErrorResponse(`File '${file}' not found in dependency graph`,
      suggestions.length > 0 ? `Did you mean: ${suggestions.slice(0, 3).join(', ')}?` : undefined)
  }

  // Extract Lambda name
  const lambdaName = extractLambdaName(normalizedFile)

  // Generate mocks
  const mocks: MockInfo[] = []
  for (const dep of transitiveDeps) {
    const mockInfo = generateMockCode(dep, entityNames)
    if (mockInfo) {
      mocks.push(mockInfo)
    }
  }

  // Calculate test file path
  const testFilePath = normalizedFile.replace('/src/', '/test/').replace(/\.ts$/, '.test.ts')

  switch (query) {
    case 'scaffold': {
      if (!lambdaName) {
        return createErrorResponse('scaffold query only supports Lambda handler files', 'Provide a path like src/lambdas/ListFiles/src/index.ts')
      }

      const scaffoldCode = generateTestScaffold(lambdaName, mocks)

      return createSuccessResponse({
        file: normalizedFile,
        testPath: testFilePath,
        lambdaName,
        generatedCode: scaffoldCode,
        mocksIncluded: mocks.map((m) => ({type: m.type, name: m.name})),
        instructions: [
          `1. Create file: ${testFilePath}`,
          '2. Paste the generated code',
          '3. Add specific test cases for your Lambda logic',
          '4. Run: pnpm test -- --testPathPattern=' + lambdaName
        ]
      })
    }

    case 'mocks': {
      // Return just the mock setup code
      const entityMocks = mocks.filter((m) => m.type === 'entity')
      const vendorMocks = mocks.filter((m) => m.type === 'vendor')

      return createSuccessResponse({
        file: normalizedFile,
        mocks: {
          entities: entityMocks.map((m) => ({name: m.name, importAlias: m.importAlias, code: m.mockCode})),
          vendors: vendorMocks.map((m) => ({name: m.name, importAlias: m.importAlias, code: m.mockCode}))
        },
        mockOrder: [
          "1. Entity mocks (vi.mock('#entities/queries', ...))",
          '2. Vendor mocks (vi.unstable_mockModule)',
          '3. Handler import (await import)'
        ],
        recommendation: entityMocks.length > 0
          ? 'Remember: Entity mocks MUST be defined before vi.unstable_mockModule calls'
          : 'Standard mock setup - define mocks before importing handler'
      })
    }

    case 'fixtures': {
      // Suggest fixture files based on dependencies
      const fixtures: Array<{name: string; purpose: string; suggested: boolean}> = []

      // API Gateway event fixture
      fixtures.push({
        name: 'APIGatewayEvent.json',
        purpose: 'Sample API Gateway proxy event with authorization',
        suggested: normalizedFile.includes('/lambdas/')
      })

      // Entity-specific fixtures
      for (const mock of mocks.filter((m) => m.type === 'entity')) {
        fixtures.push({name: `${mock.name}-query-response.json`, purpose: `Mock response for ${mock.name} queries`, suggested: true})
      }

      // Response fixtures
      fixtures.push({name: 'success-response.json', purpose: 'Expected success response format', suggested: true})

      fixtures.push({name: 'error-response.json', purpose: 'Expected error response format', suggested: true})

      return createSuccessResponse({
        file: normalizedFile,
        suggestedFixtures: fixtures.filter((f) => f.suggested),
        fixtureDirectory: testFilePath.replace('index.test.ts', 'fixtures/'),
        recommendation: 'Create fixtures based on production data using logIncomingFixture/logOutgoingFixture'
      })
    }

    case 'structure': {
      // Return test file structure without full code
      return createSuccessResponse({
        file: normalizedFile,
        testPath: testFilePath,
        structure: {
          imports: [
            'vitest (beforeAll, beforeEach, describe, expect, vi, test)',
            'aws-lambda types',
            entityNames.length > 0 ? "vi.mock('#entities/queries', ...)" : null
          ].filter(Boolean),
          setup: {beforeAll: 'Environment variables', mocks: mocks.map((m) => `${m.type}: ${m.name}`), handlerImport: 'await import after mocks'},
          testSuites: ['success cases', 'error cases', 'edge cases'],
          helpers: ['createMockContext', 'createTestEvent']
        },
        dependencies: {
          entities: mocks.filter((m) => m.type === 'entity').map((m) => m.name),
          vendors: mocks.filter((m) => m.type === 'vendor').map((m) => m.name)
        }
      })
    }

    default:
      return createErrorResponse(`Unknown query: ${query}`, 'Available queries: scaffold, mocks, fixtures, structure')
  }
}
