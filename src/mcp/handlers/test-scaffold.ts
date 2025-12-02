/**
 * Test scaffolding handler for MCP server
 * Generates complete test file scaffolding with all required mocks
 *
 * Uses build/graph.json for dependency analysis and existing test patterns
 */

import {discoverEntities, loadDependencyGraph} from './data-loader.js'

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
 * Generate mock code for a dependency
 */
function generateMockCode(dep: string, entityNames: string[]): MockInfo | null {
  // Entity mocks
  const entityMatch = dep.match(/src\/entities\/(\w+)/)
  if (entityMatch && entityNames.includes(entityMatch[1])) {
    const entityName = entityMatch[1]
    return {
      type: 'entity',
      name: entityName,
      path: dep,
      importAlias: `#entities/${entityName}`,
      mockCode: `// ${entityName} entity mock
const ${entityName.toLowerCase()}Mock = createElectroDBEntityMock({queryIndexes: ['byKey']})
jest.unstable_mockModule('#entities/${entityName}', () => ({${entityName}: ${entityName.toLowerCase()}Mock.entity}))`
    }
  }

  // AWS Vendor mocks
  const awsVendorMatch = dep.match(/src\/lib\/vendor\/AWS\/(\w+)/)
  if (awsVendorMatch) {
    const serviceName = awsVendorMatch[1]
    const mockFunctions = getAwsServiceMocks(serviceName)
    return {
      type: 'vendor',
      name: `AWS/${serviceName}`,
      path: dep,
      importAlias: `#lib/vendor/AWS/${serviceName}`,
      mockCode: `// AWS ${serviceName} mock
jest.unstable_mockModule('#lib/vendor/AWS/${serviceName}', () => ({
${mockFunctions.map((fn) => `  ${fn}: jest.fn()`).join(',\n')}
}))`
    }
  }

  // Other vendor mocks (YouTube, etc.)
  const vendorMatch = dep.match(/src\/lib\/vendor\/(\w+)/)
  if (vendorMatch && !dep.includes('/AWS/')) {
    const vendorName = vendorMatch[1]
    return {
      type: 'vendor',
      name: vendorName,
      path: dep,
      importAlias: `#lib/vendor/${vendorName}`,
      mockCode: `// ${vendorName} vendor mock
jest.unstable_mockModule('#lib/vendor/${vendorName}', () => ({
  // Add mock functions as needed
}))`
    }
  }

  // X-Ray wrapper
  if (dep.includes('XRay')) {
    return {
      type: 'vendor',
      name: 'XRay',
      path: dep,
      importAlias: '#lib/vendor/AWS/XRay',
      mockCode: `// X-Ray mock (passthrough)
jest.unstable_mockModule('#lib/vendor/AWS/XRay', () => ({
  withXRay: (handler: unknown) => handler
}))`
    }
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
    SQS: ['sendMessage', 'receiveMessage', 'deleteMessage'],
    SecretsManager: ['getSecret'],
    CloudWatch: ['putMetric', 'putLogEvents']
  }
  return serviceMocks[service] || ['mockFunction']
}

/**
 * Generate complete test file scaffold
 */
function generateTestScaffold(lambdaName: string, mocks: MockInfo[]): string {
  const entityMocks = mocks.filter((m) => m.type === 'entity')
  const vendorMocks = mocks.filter((m) => m.type === 'vendor')

  const lines: string[] = []

  // Imports
  lines.push("import {beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'")
  lines.push("import type {APIGatewayProxyEvent, Context} from 'aws-lambda'")

  if (entityMocks.length > 0) {
    lines.push("import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'")
  }

  lines.push('')

  // Environment setup
  lines.push('// Environment setup')
  lines.push('beforeAll(() => {')
  lines.push("  process.env.TableName = 'test-table'")
  lines.push("  process.env.Region = 'us-east-1'")
  lines.push('})')
  lines.push('')

  // Entity mocks (must be before other mocks)
  if (entityMocks.length > 0) {
    lines.push('// Entity mocks')
    for (const mock of entityMocks) {
      lines.push(mock.mockCode)
      lines.push('')
    }
  }

  // Vendor mocks
  if (vendorMocks.length > 0) {
    lines.push('// Vendor mocks')
    for (const mock of vendorMocks) {
      lines.push(mock.mockCode)
      lines.push('')
    }
  }

  // Import handler after mocks
  lines.push('// Import handler after mocks')
  lines.push("const {handler} = await import('../src')")
  lines.push('')

  // Test context helper
  lines.push('// Test helpers')
  lines.push('const testContext: Context = {')
  lines.push("  functionName: 'test',")
  lines.push("  functionVersion: '1',")
  lines.push("  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',")
  lines.push("  memoryLimitInMB: '128',")
  lines.push("  awsRequestId: 'test-request-id',")
  lines.push("  logGroupName: 'test-log-group',")
  lines.push("  logStreamName: 'test-log-stream',")
  lines.push('  getRemainingTimeInMillis: () => 30000,')
  lines.push('  done: () => {},')
  lines.push('  fail: () => {},')
  lines.push('  succeed: () => {}')
  lines.push('} as Context')
  lines.push('')

  // Test suite
  lines.push(`describe('#${lambdaName}', () => {`)
  lines.push('  beforeEach(() => {')
  lines.push('    jest.clearAllMocks()')

  // Reset entity mocks
  for (const mock of entityMocks) {
    const entityName = mock.name.toLowerCase()
    lines.push(`    ${entityName}Mock.reset()`)
  }

  lines.push('  })')
  lines.push('')

  lines.push("  describe('success cases', () => {")
  lines.push("    test('should handle valid request', async () => {")
  lines.push('      // Arrange')
  lines.push('      const event: Partial<APIGatewayProxyEvent> = {')
  lines.push('        requestContext: {')
  lines.push('          authorizer: {')
  lines.push("            userId: 'test-user-id'")
  lines.push('          }')
  lines.push('        } as unknown as APIGatewayProxyEvent["requestContext"],')
  lines.push('        body: JSON.stringify({})')
  lines.push('      }')
  lines.push('')

  // Set up mock returns for entities
  for (const mock of entityMocks) {
    const entityName = mock.name.toLowerCase()
    lines.push(`      ${entityName}Mock.query.go.mockResolvedValue({data: []})`)
  }

  lines.push('')
  lines.push('      // Act')
  lines.push('      const result = await handler(event as APIGatewayProxyEvent, testContext)')
  lines.push('')
  lines.push('      // Assert')
  lines.push('      expect(result.statusCode).toBe(200)')
  lines.push('    })')
  lines.push('  })')
  lines.push('')

  lines.push("  describe('error cases', () => {")
  lines.push("    test('should handle missing authorization', async () => {")
  lines.push('      // Arrange')
  lines.push('      const event: Partial<APIGatewayProxyEvent> = {')
  lines.push('        requestContext: {} as unknown as APIGatewayProxyEvent["requestContext"]')
  lines.push('      }')
  lines.push('')
  lines.push('      // Act')
  lines.push('      const result = await handler(event as APIGatewayProxyEvent, testContext)')
  lines.push('')
  lines.push('      // Assert')
  lines.push('      expect(result.statusCode).toBe(401)')
  lines.push('    })')
  lines.push('  })')

  lines.push('})')

  return lines.join('\n')
}

export async function handleTestScaffoldQuery(args: TestScaffoldQueryArgs) {
  const {file, query} = args

  if (!file) {
    return {error: 'File path required', example: {file: 'src/lambdas/ListFiles/src/index.ts', query: 'scaffold'}}
  }

  // Load data
  const [depGraph, entityNames] = await Promise.all([loadDependencyGraph(), discoverEntities()])

  // Normalize file path
  const normalizedFile = file.startsWith('src/') ? file : `src/${file}`

  // Get transitive dependencies
  const transitiveDeps = depGraph.transitiveDependencies[normalizedFile] || []

  if (transitiveDeps.length === 0) {
    const suggestions = Object.keys(depGraph.transitiveDependencies).filter((k) => k.includes(file.split('/').pop()!.replace('.ts', ''))).slice(0, 5)

    return {error: `File '${file}' not found in dependency graph`, suggestions: suggestions.length > 0 ? suggestions : undefined}
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
        return {
          error: 'scaffold query only supports Lambda handler files',
          hint: 'Provide a path like src/lambdas/ListFiles/src/index.ts',
          file: normalizedFile
        }
      }

      const scaffoldCode = generateTestScaffold(lambdaName, mocks)

      return {
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
      }
    }

    case 'mocks': {
      // Return just the mock setup code
      const entityMocks = mocks.filter((m) => m.type === 'entity')
      const vendorMocks = mocks.filter((m) => m.type === 'vendor')

      return {
        file: normalizedFile,
        mocks: {
          entities: entityMocks.map((m) => ({name: m.name, importAlias: m.importAlias, code: m.mockCode})),
          vendors: vendorMocks.map((m) => ({name: m.name, importAlias: m.importAlias, code: m.mockCode}))
        },
        mockOrder: [
          '1. Entity mocks (createElectroDBEntityMock)',
          '2. Vendor mocks (jest.unstable_mockModule)',
          '3. Handler import (await import)'
        ],
        recommendation: entityMocks.length > 0
          ? 'Remember: Entity mocks MUST be defined before jest.unstable_mockModule calls'
          : 'Standard mock setup - define mocks before importing handler'
      }
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

      return {
        file: normalizedFile,
        suggestedFixtures: fixtures.filter((f) => f.suggested),
        fixtureDirectory: testFilePath.replace('index.test.ts', 'fixtures/'),
        recommendation: 'Create fixtures based on production data using logIncomingFixture/logOutgoingFixture'
      }
    }

    case 'structure': {
      // Return test file structure without full code
      return {
        file: normalizedFile,
        testPath: testFilePath,
        structure: {
          imports: [
            '@jest/globals (beforeAll, beforeEach, describe, expect, jest, test)',
            'aws-lambda types',
            entityNames.length > 0 ? 'createElectroDBEntityMock from test helpers' : null
          ].filter(Boolean),
          setup: {beforeAll: 'Environment variables', mocks: mocks.map((m) => `${m.type}: ${m.name}`), handlerImport: 'await import after mocks'},
          testSuites: ['success cases', 'error cases', 'edge cases'],
          helpers: ['testContext', 'createTestEvent']
        },
        dependencies: {
          entities: mocks.filter((m) => m.type === 'entity').map((m) => m.name),
          vendors: mocks.filter((m) => m.type === 'vendor').map((m) => m.name)
        }
      }
    }

    default:
      return {
        error: `Unknown query: ${query}`,
        availableQueries: ['scaffold', 'mocks', 'fixtures', 'structure'],
        examples: [
          {file: 'src/lambdas/ListFiles/src/index.ts', query: 'scaffold'},
          {file: 'src/lambdas/ListFiles/src/index.ts', query: 'mocks'},
          {file: 'src/lambdas/ListFiles/src/index.ts', query: 'fixtures'}
        ]
      }
  }
}
