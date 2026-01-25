/**
 * Convention query handler for MCP server
 * Provides access to project conventions from wiki
 *
 * Data is dynamically loaded from:
 * - docs/wiki/Meta/Conventions-Tracking.md (structured convention registry)
 * - docs/wiki/ (detailed documentation pages)
 */

import {discoverWikiPages, loadConventions, loadWikiPage, searchWikiPages} from './data-loader.js'
import {type ConventionCategory, type ConventionSeverity, filterByCategory, filterBySeverity, searchConventions} from '../parsers/convention-parser.js'
import {createErrorResponse, createSuccessResponse} from './shared/response-types.js'

export type ConventionQueryType = 'list' | 'search' | 'category' | 'enforcement' | 'detail' | 'wiki'

export interface ConventionQueryArgs {
  query: ConventionQueryType
  term?: string
  category?: ConventionCategory
  severity?: ConventionSeverity
  convention?: string
}

/** Handles MCP queries for project conventions and patterns. */
export async function handleConventionsQuery(args: ConventionQueryArgs) {
  const {query, term, category, severity, convention} = args
  const conventions = await loadConventions() // Load conventions dynamically
  switch (query) {
    case 'list': {
      // Return all conventions with summary info
      const summary = conventions.map((c) => ({
        name: c.name,
        type: c.type,
        category: c.category,
        severity: c.severity,
        status: c.status,
        enforcement: c.enforcement,
        wikiPath: c.wikiPath
      }))

      // Group by severity for easier reading
      const bySeverity = {
        CRITICAL: summary.filter((c) => c.severity === 'CRITICAL'),
        HIGH: summary.filter((c) => c.severity === 'HIGH'),
        MEDIUM: summary.filter((c) => c.severity === 'MEDIUM'),
        LOW: summary.filter((c) => c.severity === 'LOW')
      }

      return createSuccessResponse({
        conventions: bySeverity,
        count: conventions.length,
        summary: {critical: bySeverity.CRITICAL.length, high: bySeverity.HIGH.length, medium: bySeverity.MEDIUM.length, low: bySeverity.LOW.length}
      })
    }

    case 'search': {
      if (!term) {
        return createErrorResponse('Search term required for search query', 'Example: {query: "search", term: "mock"}')
      }

      // Search conventions
      const conventionMatches = searchConventions(conventions, term)

      // Also search wiki pages
      const wikiMatches = await searchWikiPages(term)

      return createSuccessResponse({
        term,
        conventionMatches: conventionMatches.map((c) => ({name: c.name, severity: c.severity, what: c.what, wikiPath: c.wikiPath})),
        wikiMatches: wikiMatches.slice(0, 10), // Limit wiki results
        totalConventions: conventionMatches.length,
        totalWikiPages: wikiMatches.length
      })
    }

    case 'category': {
      if (!category) {
        // List available categories with counts
        const categories: Record<string, number> = {}
        for (const c of conventions) {
          categories[c.category] = (categories[c.category] || 0) + 1
        }
        return createSuccessResponse({availableCategories: Object.keys(categories).sort(), counts: categories, example: {query: 'category', category: 'testing'}})
      }

      const filtered = filterByCategory(conventions, category)
      return createSuccessResponse({
        category,
        conventions: filtered.map((c) => ({name: c.name, severity: c.severity, what: c.what, enforcement: c.enforcement})),
        count: filtered.length
      })
    }

    case 'enforcement': {
      if (!severity) {
        // Return conventions grouped by severity
        return createSuccessResponse({
          CRITICAL: filterBySeverity(conventions, 'CRITICAL').map((c) => ({name: c.name, what: c.what, enforcement: c.enforcement})),
          HIGH: filterBySeverity(conventions, 'HIGH').map((c) => ({name: c.name, what: c.what, enforcement: c.enforcement})),
          MEDIUM: filterBySeverity(conventions, 'MEDIUM').map((c) => ({name: c.name, what: c.what})),
          availableSeverities: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
          example: {query: 'enforcement', severity: 'CRITICAL'}
        })
      }

      const filtered = filterBySeverity(conventions, severity)
      return createSuccessResponse({
        severity,
        conventions: filtered.map((c) => ({name: c.name, what: c.what, why: c.why, enforcement: c.enforcement, wikiPath: c.wikiPath})),
        count: filtered.length
      })
    }

    case 'detail': {
      if (!convention) {
        return createErrorResponse('Convention name required for detail query', `Available: ${conventions.map((c) => c.name).slice(0, 5).join(', ')}...`)
      }

      // Find convention by name (case-insensitive partial match)
      const conventionLower = convention.toLowerCase()
      const match = conventions.find((c) => c.name.toLowerCase().includes(conventionLower))

      if (!match) {
        return createErrorResponse(`Convention '${convention}' not found`, `Available: ${conventions.map((c) => c.name).slice(0, 5).join(', ')}...`)
      }

      // If wiki path exists, load the full documentation
      let wikiContent: string | undefined
      if (match.wikiPath) {
        try {
          wikiContent = await loadWikiPage(match.wikiPath)
        } catch {
          wikiContent = `Wiki page not found at: ${match.wikiPath}`
        }
      }

      return createSuccessResponse({
        convention: {
          name: match.name,
          type: match.type,
          category: match.category,
          severity: match.severity,
          status: match.status,
          what: match.what,
          why: match.why,
          enforcement: match.enforcement,
          detectedDate: match.detectedDate,
          wikiPath: match.wikiPath
        },
        wikiContent: wikiContent ? wikiContent.substring(0, 3000) : undefined // Limit content size
      })
    }

    case 'wiki': {
      // List all wiki pages or get specific page content
      if (!term) {
        const pages = await discoverWikiPages()

        // Group by directory
        const byDirectory: Record<string, string[]> = {}
        for (const page of pages) {
          const parts = page.split('/')
          const dir = parts.length > 3 ? parts[2] : 'root' // docs/wiki/[Category]/
          if (!byDirectory[dir]) {
            byDirectory[dir] = []
          }
          byDirectory[dir].push(page)
        }

        return createSuccessResponse({totalPages: pages.length, byDirectory, example: {query: 'wiki', term: 'docs/wiki/Testing/Jest-ESM-Mocking-Strategy.md'}})
      }

      // Load specific page
      try {
        const content = await loadWikiPage(term)
        return createSuccessResponse({
          path: term,
          content: content.substring(0, 5000) // Limit content size
        })
      } catch {
        return createErrorResponse(`Wiki page not found: ${term}`)
      }
    }

    default:
      return createErrorResponse(`Unknown query: ${query}`, 'Available queries: list, search, category, enforcement, detail, wiki')
  }
}
