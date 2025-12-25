/**
 * Unit tests for data-loader module
 * Tests shared data loading for MCP handlers
 *
 * Note: This module uses import.meta.url which makes mocking difficult.
 * These tests run against the actual project files (integration-style).
 */

import {beforeAll, describe, expect, test} from '@jest/globals'

// Module loaded via dynamic import
let loadMetadata: typeof import('./data-loader').loadMetadata
let loadDependencyGraph: typeof import('./data-loader').loadDependencyGraph
let discoverLambdas: typeof import('./data-loader').discoverLambdas
let discoverEntities: typeof import('./data-loader').discoverEntities
let getLambdaConfigs: typeof import('./data-loader').getLambdaConfigs
let getEntityInfo: typeof import('./data-loader').getEntityInfo
let getLambdaInvocations: typeof import('./data-loader').getLambdaInvocations
let getExternalServices: typeof import('./data-loader').getExternalServices
let getAwsServices: typeof import('./data-loader').getAwsServices
let loadConventions: typeof import('./data-loader').loadConventions
let discoverWikiPages: typeof import('./data-loader').discoverWikiPages
let searchWikiPages: typeof import('./data-loader').searchWikiPages
let loadWikiPage: typeof import('./data-loader').loadWikiPage

beforeAll(async () => {
  const module = await import('./data-loader')
  loadMetadata = module.loadMetadata
  loadDependencyGraph = module.loadDependencyGraph
  discoverLambdas = module.discoverLambdas
  discoverEntities = module.discoverEntities
  getLambdaConfigs = module.getLambdaConfigs
  getEntityInfo = module.getEntityInfo
  getLambdaInvocations = module.getLambdaInvocations
  getExternalServices = module.getExternalServices
  getAwsServices = module.getAwsServices
  loadConventions = module.loadConventions
  discoverWikiPages = module.discoverWikiPages
  searchWikiPages = module.searchWikiPages
  loadWikiPage = module.loadWikiPage
})

describe('loadMetadata', () => {
  test('should load and parse metadata.json', async () => {
    const metadata = await loadMetadata()

    expect(metadata).toBeDefined()
    expect(metadata.lambdas).toBeDefined()
    expect(typeof metadata.lambdas).toBe('object')
  })

  test('should have lambdas with trigger and purpose', async () => {
    const metadata = await loadMetadata()
    const lambdaNames = Object.keys(metadata.lambdas)

    expect(lambdaNames.length).toBeGreaterThan(0)

    for (const name of lambdaNames) {
      const lambda = metadata.lambdas[name]
      expect(lambda).toHaveProperty('trigger')
      expect(lambda).toHaveProperty('purpose')
    }
  })

  test('should have external services', async () => {
    const metadata = await loadMetadata()

    expect(Array.isArray(metadata.externalServices)).toBe(true)
    expect(metadata.externalServices.length).toBeGreaterThan(0)
  })

  test('should have AWS services', async () => {
    const metadata = await loadMetadata()

    expect(Array.isArray(metadata.awsServices)).toBe(true)
    expect(metadata.awsServices.length).toBeGreaterThan(0)
  })

  test('should have entity relationships', async () => {
    const metadata = await loadMetadata()

    expect(Array.isArray(metadata.entityRelationships)).toBe(true)
  })
})

describe('loadDependencyGraph', () => {
  test('should load and parse graph.json', async () => {
    const graph = await loadDependencyGraph()

    expect(graph).toBeDefined()
    expect(graph.metadata).toBeDefined()
    expect(graph.transitiveDependencies).toBeDefined()
  })

  test('should have file entries', async () => {
    const graph = await loadDependencyGraph()
    const files = Object.keys(graph.files || graph.transitiveDependencies)

    expect(files.length).toBeGreaterThan(0)
  })

  test('should have transitive dependencies', async () => {
    const graph = await loadDependencyGraph()

    expect(typeof graph.transitiveDependencies).toBe('object')
    expect(Object.keys(graph.transitiveDependencies).length).toBeGreaterThan(0)
  })
})

describe('discoverLambdas', () => {
  test('should discover Lambda directories', async () => {
    const lambdas = await discoverLambdas()

    expect(Array.isArray(lambdas)).toBe(true)
    expect(lambdas.length).toBeGreaterThan(0)
  })

  test('should include known Lambda names', async () => {
    const lambdas = await discoverLambdas()

    // Check for at least some expected Lambdas
    const knownLambdas = ['ListFiles', 'LoginUser', 'RegisterDevice', 'FileCoordinator']
    const found = knownLambdas.filter((l) => lambdas.includes(l))

    expect(found.length).toBeGreaterThan(0)
  })

  test('should return sorted array', async () => {
    const lambdas = await discoverLambdas()
    const sorted = [...lambdas].sort()

    expect(lambdas).toEqual(sorted)
  })
})

describe('discoverEntities', () => {
  test('should discover Entity files', async () => {
    const entities = await discoverEntities()

    expect(Array.isArray(entities)).toBe(true)
    expect(entities.length).toBeGreaterThan(0)
  })

  test('should include known entities', async () => {
    const entities = await discoverEntities()

    // Check for expected entities
    expect(entities).toContain('Users')
    expect(entities).toContain('Files')
  })

  test('should exclude Collections.ts', async () => {
    const entities = await discoverEntities()

    expect(entities).not.toContain('Collections')
  })

  test('should return clean entity names without .ts', async () => {
    const entities = await discoverEntities()

    for (const entity of entities) {
      expect(entity).not.toContain('.ts')
    }
  })
})

describe('getLambdaConfigs', () => {
  test('should combine metadata with dependencies', async () => {
    const configs = await getLambdaConfigs()

    expect(typeof configs).toBe('object')
    const names = Object.keys(configs)
    expect(names.length).toBeGreaterThan(0)
  })

  test('should have required fields for each Lambda', async () => {
    const configs = await getLambdaConfigs()

    for (const [name, config] of Object.entries(configs)) {
      expect(config).toHaveProperty('name', name)
      expect(config).toHaveProperty('trigger')
      expect(config).toHaveProperty('purpose')
      expect(config).toHaveProperty('dependencies')
      expect(config).toHaveProperty('entities')
      expect(Array.isArray(config.dependencies)).toBe(true)
      expect(Array.isArray(config.entities)).toBe(true)
    }
  })
})

describe('getEntityInfo', () => {
  test('should return entities and relationships', async () => {
    const info = await getEntityInfo()

    expect(info).toHaveProperty('entities')
    expect(info).toHaveProperty('relationships')
    expect(Array.isArray(info.entities)).toBe(true)
    expect(Array.isArray(info.relationships)).toBe(true)
  })

  test('should have entities matching discovery', async () => {
    const info = await getEntityInfo()
    const discovered = await discoverEntities()

    expect(info.entities).toEqual(discovered)
  })
})

describe('getLambdaInvocations', () => {
  test('should return invocation chains', async () => {
    const invocations = await getLambdaInvocations()

    expect(Array.isArray(invocations)).toBe(true)
  })

  test('should have from/to/via structure', async () => {
    const invocations = await getLambdaInvocations()

    if (invocations.length > 0) {
      expect(invocations[0]).toHaveProperty('from')
      expect(invocations[0]).toHaveProperty('to')
      expect(invocations[0]).toHaveProperty('via')
    }
  })
})

describe('getExternalServices', () => {
  test('should return external services', async () => {
    const services = await getExternalServices()

    expect(Array.isArray(services)).toBe(true)
    expect(services.length).toBeGreaterThan(0)
  })

  test('should have name and type', async () => {
    const services = await getExternalServices()

    for (const service of services) {
      expect(service).toHaveProperty('name')
      expect(service).toHaveProperty('type')
    }
  })
})

describe('getAwsServices', () => {
  test('should return AWS services', async () => {
    const services = await getAwsServices()

    expect(Array.isArray(services)).toBe(true)
    expect(services.length).toBeGreaterThan(0)
  })

  test('should have vendorPath for wrapper services', async () => {
    const services = await getAwsServices()
    const withVendor = services.filter((s) => s.vendorPath)

    expect(withVendor.length).toBeGreaterThan(0)
  })
})

describe('loadConventions', () => {
  test('should load and parse conventions', async () => {
    const conventions = await loadConventions()

    expect(Array.isArray(conventions)).toBe(true)
    expect(conventions.length).toBeGreaterThan(0)
  })

  test('should have required convention fields', async () => {
    const conventions = await loadConventions()

    for (const conv of conventions) {
      expect(conv).toHaveProperty('name')
      expect(conv).toHaveProperty('severity')
      expect(conv).toHaveProperty('status')
    }
  })
})

describe('loadWikiPage', () => {
  test('should load a wiki page', async () => {
    const pages = await discoverWikiPages()
    if (pages.length > 0) {
      const content = await loadWikiPage(pages[0])

      expect(typeof content).toBe('string')
      expect(content.length).toBeGreaterThan(0)
    }
  })
})

describe('discoverWikiPages', () => {
  test('should discover wiki pages', async () => {
    const pages = await discoverWikiPages()

    expect(Array.isArray(pages)).toBe(true)
    expect(pages.length).toBeGreaterThan(0)
  })

  test('should return markdown files only', async () => {
    const pages = await discoverWikiPages()

    for (const page of pages) {
      expect(page).toMatch(/\.md$/)
    }
  })

  test('should return relative paths', async () => {
    const pages = await discoverWikiPages()

    for (const page of pages) {
      expect(page.startsWith('docs/wiki/')).toBe(true)
    }
  })
})

describe('searchWikiPages', () => {
  test('should search wiki pages', async () => {
    const results = await searchWikiPages('AWS')

    expect(Array.isArray(results)).toBe(true)
  })

  test('should return path and matches', async () => {
    const results = await searchWikiPages('import')

    if (results.length > 0) {
      expect(results[0]).toHaveProperty('path')
      expect(results[0]).toHaveProperty('matches')
    }
  })

  test('should find pages matching filename', async () => {
    const results = await searchWikiPages('Vendor')

    const hasMatch = results.some((r) => r.path.toLowerCase().includes('vendor'))
    expect(hasMatch).toBe(true)
  })
})

describe('function exports', () => {
  test('should export all data loader functions', async () => {
    expect(typeof loadMetadata).toBe('function')
    expect(typeof loadDependencyGraph).toBe('function')
    expect(typeof discoverLambdas).toBe('function')
    expect(typeof discoverEntities).toBe('function')
    expect(typeof getLambdaConfigs).toBe('function')
    expect(typeof getEntityInfo).toBe('function')
    expect(typeof getLambdaInvocations).toBe('function')
    expect(typeof getExternalServices).toBe('function')
    expect(typeof getAwsServices).toBe('function')
    expect(typeof loadConventions).toBe('function')
    expect(typeof loadWikiPage).toBe('function')
    expect(typeof discoverWikiPages).toBe('function')
    expect(typeof searchWikiPages).toBe('function')
  })
})
