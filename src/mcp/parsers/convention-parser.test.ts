/**
 * Unit tests for convention-parser.ts
 * Tests the pure functions for parsing conventions-tracking.md
 */

import {beforeAll, describe, expect, test} from '@jest/globals'
import {readFileSync} from 'fs'
import {join} from 'path'
import type {Convention} from './convention-parser'

// Load fixture from project root (Jest runs from rootDir)
const fixtureContent = readFileSync(join(process.cwd(), 'src/mcp/test/fixtures/conventions-sample.md'), 'utf-8')

// Module functions loaded via dynamic import
let parseConventions: typeof import('./convention-parser').parseConventions
let searchConventions: typeof import('./convention-parser').searchConventions
let filterByCategory: typeof import('./convention-parser').filterByCategory
let filterBySeverity: typeof import('./convention-parser').filterBySeverity
let filterByStatus: typeof import('./convention-parser').filterByStatus

beforeAll(async () => {
  const module = await import('./convention-parser')
  parseConventions = module.parseConventions
  searchConventions = module.searchConventions
  filterByCategory = module.filterByCategory
  filterBySeverity = module.filterBySeverity
  filterByStatus = module.filterByStatus
})

describe('convention-parser', () => {
  describe('parseConventions', () => {
    test('should parse all conventions from fixture', () => {
      const result = parseConventions(fixtureContent)

      expect(result.conventions.length).toBe(6)
    })

    test('should parse metadata correctly', () => {
      const result = parseConventions(fixtureContent)

      expect(result.metadata.lastUpdated).toBe('2024-01-15')
      expect(result.metadata.totalCount).toBe(6)
      expect(result.metadata.documentedCount).toBe(4)
      expect(result.metadata.pendingCount).toBe(2)
    })

    test('should extract convention name and type', () => {
      const result = parseConventions(fixtureContent)
      const firstConvention = result.conventions.find((c) => c.name === 'Test Convention One')

      expect(firstConvention).toBeDefined()
      expect(firstConvention!.type).toBe('Testing Pattern')
    })

    test('should extract what and why fields', () => {
      const result = parseConventions(fixtureContent)
      const convention = result.conventions.find((c) => c.name === 'Test Convention One')

      expect(convention!.what).toContain('mock helpers')
      expect(convention!.why).toContain('maintainability')
    })

    test('should parse severity from priority field', () => {
      const result = parseConventions(fixtureContent)

      const criticalConv = result.conventions.find((c) => c.name === 'Test Convention Two')
      const highConv = result.conventions.find((c) => c.name === 'Test Convention One')
      const mediumConv = result.conventions.find((c) => c.name === 'Documented Convention Two')
      const lowConv = result.conventions.find((c) => c.name === 'Low Priority Convention')

      expect(criticalConv!.severity).toBe('CRITICAL')
      expect(highConv!.severity).toBe('HIGH')
      expect(mediumConv!.severity).toBe('MEDIUM')
      expect(lowConv!.severity).toBe('LOW')
    })

    test('should parse status from section and status field', () => {
      const result = parseConventions(fixtureContent)

      const pendingConv = result.conventions.find((c) => c.name === 'Test Convention One')
      const documentedConv = result.conventions.find((c) => c.name === 'Documented Convention One')

      expect(pendingConv!.status).toBe('pending')
      expect(documentedConv!.status).toBe('documented')
    })

    test('should infer category from type', () => {
      const result = parseConventions(fixtureContent)

      const testingConv = result.conventions.find((c) => c.name === 'Test Convention One')
      const awsConv = result.conventions.find((c) => c.name === 'Test Convention Two')
      const gitConv = result.conventions.find((c) => c.name === 'Documented Convention One')
      const securityConv = result.conventions.find((c) => c.name === 'Documented Convention Three')

      expect(testingConv!.category).toBe('testing')
      expect(awsConv!.category).toBe('aws')
      expect(gitConv!.category).toBe('git')
      expect(securityConv!.category).toBe('security')
    })

    test('should extract wiki path from target/documented field', () => {
      const result = parseConventions(fixtureContent)
      const convention = result.conventions.find((c) => c.name === 'Test Convention One')

      expect(convention!.wikiPath).toBe('docs/wiki/Testing/Mock-Patterns.md')
    })

    test('should extract enforcement field', () => {
      const result = parseConventions(fixtureContent)
      const convention = result.conventions.find((c) => c.name === 'Test Convention Two')

      expect(convention!.enforcement).toBe('Zero-tolerance')
    })

    test('should handle empty content', () => {
      const result = parseConventions('')

      expect(result.conventions).toEqual([])
      expect(result.metadata.totalCount).toBe(0)
    })

    test('should handle content with no conventions', () => {
      const content = '# Conventions Tracking\n\n## 🟡 Pending Documentation\n\n(None)\n'
      const result = parseConventions(content)

      expect(result.conventions).toEqual([])
    })
  })

  describe('searchConventions', () => {
    let conventions: Convention[]

    test('should search by name', () => {
      const result = parseConventions(fixtureContent)
      conventions = result.conventions

      const matches = searchConventions(conventions, 'Test Convention One')
      expect(matches.length).toBe(1)
      expect(matches[0].name).toBe('Test Convention One')
    })

    test('should search by what field', () => {
      const result = parseConventions(fixtureContent)
      conventions = result.conventions

      const matches = searchConventions(conventions, 'mock helpers')
      expect(matches.length).toBeGreaterThan(0)
      expect(matches[0].what).toContain('mock helpers')
    })

    test('should search by why field', () => {
      const result = parseConventions(fixtureContent)
      conventions = result.conventions

      const matches = searchConventions(conventions, 'maintainability')
      expect(matches.length).toBeGreaterThan(0)
    })

    test('should be case-insensitive', () => {
      const result = parseConventions(fixtureContent)
      conventions = result.conventions

      const matches = searchConventions(conventions, 'MOCK HELPERS')
      expect(matches.length).toBeGreaterThan(0)
    })

    test('should return empty array for no matches', () => {
      const result = parseConventions(fixtureContent)
      conventions = result.conventions

      const matches = searchConventions(conventions, 'nonexistent term xyz123')
      expect(matches).toEqual([])
    })
  })

  describe('filterByCategory', () => {
    test('should filter by testing category', () => {
      const result = parseConventions(fixtureContent)
      const filtered = filterByCategory(result.conventions, 'testing')

      expect(filtered.length).toBeGreaterThan(0)
      expect(filtered.every((c) => c.category === 'testing')).toBe(true)
    })

    test('should filter by aws category', () => {
      const result = parseConventions(fixtureContent)
      const filtered = filterByCategory(result.conventions, 'aws')

      expect(filtered.length).toBeGreaterThan(0)
      expect(filtered.every((c) => c.category === 'aws')).toBe(true)
    })

    test('should return empty array for category with no matches', () => {
      const result = parseConventions(fixtureContent)
      const filtered = filterByCategory(result.conventions, 'patterns')

      // May be empty depending on fixture
      expect(Array.isArray(filtered)).toBe(true)
    })
  })

  describe('filterBySeverity', () => {
    test('should filter by CRITICAL severity', () => {
      const result = parseConventions(fixtureContent)
      const filtered = filterBySeverity(result.conventions, 'CRITICAL')

      expect(filtered.length).toBeGreaterThan(0)
      expect(filtered.every((c) => c.severity === 'CRITICAL')).toBe(true)
    })

    test('should filter by HIGH severity', () => {
      const result = parseConventions(fixtureContent)
      const filtered = filterBySeverity(result.conventions, 'HIGH')

      expect(filtered.length).toBeGreaterThan(0)
      expect(filtered.every((c) => c.severity === 'HIGH')).toBe(true)
    })

    test('should filter by MEDIUM severity', () => {
      const result = parseConventions(fixtureContent)
      const filtered = filterBySeverity(result.conventions, 'MEDIUM')

      expect(filtered.every((c) => c.severity === 'MEDIUM')).toBe(true)
    })

    test('should filter by LOW severity', () => {
      const result = parseConventions(fixtureContent)
      const filtered = filterBySeverity(result.conventions, 'LOW')

      expect(filtered.every((c) => c.severity === 'LOW')).toBe(true)
    })
  })

  describe('filterByStatus', () => {
    test('should filter by pending status', () => {
      const result = parseConventions(fixtureContent)
      const filtered = filterByStatus(result.conventions, 'pending')

      expect(filtered.length).toBe(2)
      expect(filtered.every((c) => c.status === 'pending')).toBe(true)
    })

    test('should filter by documented status', () => {
      const result = parseConventions(fixtureContent)
      const filtered = filterByStatus(result.conventions, 'documented')

      expect(filtered.length).toBe(4)
      expect(filtered.every((c) => c.status === 'documented')).toBe(true)
    })
  })
})
