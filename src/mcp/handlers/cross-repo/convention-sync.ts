/**
 * Convention sync handler for MCP server
 * Import/export conventions for multi-repo consistency
 *
 * Features:
 * - Export conventions to shareable formats (JSON, YAML, Markdown)
 * - Import conventions from external sources
 * - Diff conventions with external sources
 */

import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'url'
import {type Convention, loadConventions} from '../data-loader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../..')

export type SyncQueryType = 'import' | 'export' | 'diff'
export type ExportFormat = 'json' | 'yaml' | 'markdown'

export interface SyncConventionsArgs {
  query: SyncQueryType
  source?: string
  format?: ExportFormat
  merge?: boolean
}

interface ExportedConvention {
  name: string
  description: string
  severity: string
  category: string
  status: string
  enforcement?: string
  documentation?: string
}

interface ConventionDiff {
  onlyLocal: string[]
  onlyRemote: string[]
  different: Array<{name: string; localSeverity: string; remoteSeverity: string}>
  identical: string[]
}

/**
 * Convert conventions to JSON format
 */
function toJSON(conventions: Convention[]): string {
  const exported: ExportedConvention[] = conventions.map((c) => ({
    name: c.name,
    description: c.what,
    severity: c.severity,
    category: c.category,
    status: c.status,
    enforcement: c.enforcement,
    documentation: c.wikiPath
  }))
  return JSON.stringify({version: '1.0', conventions: exported}, null, 2)
}

/**
 * Convert conventions to YAML format
 */
function toYAML(conventions: Convention[]): string {
  const lines = ['# Project Conventions', `# Exported: ${new Date().toISOString()}`, '', 'conventions:']
  for (const c of conventions) {
    lines.push(`  - name: "${c.name}"`)
    lines.push(`    description: "${c.what.replace(/"/g, '\\"')}"`)
    lines.push(`    severity: ${c.severity}`)
    lines.push(`    category: ${c.category}`)
    lines.push(`    status: ${c.status}`)
    if (c.enforcement) {
      lines.push(`    enforcement: "${c.enforcement}"`)
    }
    if (c.wikiPath) {
      lines.push(`    documentation: "${c.wikiPath}"`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Convert conventions to Markdown format
 */
function toMarkdown(conventions: Convention[]): string {
  const lines = ['# Project Conventions', '', `> Exported: ${new Date().toISOString()}`, '']

  // Group by category
  const byCategory: Record<string, Convention[]> = {}
  for (const c of conventions) {
    if (!byCategory[c.category]) {
      byCategory[c.category] = []
    }
    byCategory[c.category].push(c)
  }

  // Sort categories
  const sortedCategories = Object.keys(byCategory).sort()

  for (const category of sortedCategories) {
    lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}`, '')

    // Sort by severity within category
    const sorted = byCategory[category].sort((a, b) => {
      const severityOrder = {CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3}
      return (severityOrder[a.severity as keyof typeof severityOrder] || 4) - (severityOrder[b.severity as keyof typeof severityOrder] || 4)
    })

    lines.push('| Convention | Severity | Status | Description |')
    lines.push('|------------|----------|--------|-------------|')

    for (const c of sorted) {
      const severityBadge = c.severity === 'CRITICAL' ? '🔴' : c.severity === 'HIGH' ? '🟠' : c.severity === 'MEDIUM' ? '🟡' : '🟢'
      lines.push(`| ${c.name} | ${severityBadge} ${c.severity} | ${c.status} | ${c.what.substring(0, 50)}${c.what.length > 50 ? '...' : ''} |`)
    }

    lines.push('')
  }

  // Add detailed descriptions
  lines.push('---', '', '## Detailed Descriptions', '')

  for (const c of conventions) {
    lines.push(`### ${c.name}`, '')
    lines.push(`**Severity:** ${c.severity}  `)
    lines.push(`**Category:** ${c.category}  `)
    lines.push(`**Status:** ${c.status}`, '')
    lines.push(c.what, '')
    if (c.enforcement) {
      lines.push(`**Enforcement:** ${c.enforcement}`, '')
    }
    if (c.wikiPath) {
      lines.push(`**Documentation:** ${c.wikiPath}`, '')
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Parse conventions from JSON
 */
function fromJSON(content: string): ExportedConvention[] {
  try {
    const data = JSON.parse(content)
    return data.conventions || []
  } catch {
    return []
  }
}

/**
 * Parse conventions from YAML (simple parser)
 */
function fromYAML(content: string): ExportedConvention[] {
  const conventions: ExportedConvention[] = []
  let current: Partial<ExportedConvention> | null = null

  const lines = content.split('\n')
  for (const line of lines) {
    if (line.trim().startsWith('- name:')) {
      if (current && current.name) {
        conventions.push(current as ExportedConvention)
      }
      current = {name: line.match(/name:\s*"?([^"]+)"?/)?.[1] || ''}
    } else if (current) {
      const descMatch = line.match(/description:\s*"?([^"]+)"?/)
      if (descMatch) {
        current.description = descMatch[1]
      }

      const sevMatch = line.match(/severity:\s*(\w+)/)
      if (sevMatch) {
        current.severity = sevMatch[1]
      }

      const catMatch = line.match(/category:\s*(\w+)/)
      if (catMatch) {
        current.category = catMatch[1]
      }

      const statMatch = line.match(/status:\s*(\w+)/)
      if (statMatch) {
        current.status = statMatch[1]
      }
    }
  }

  if (current && current.name) {
    conventions.push(current as ExportedConvention)
  }

  return conventions
}

/**
 * Load conventions from a source
 */
async function loadFromSource(source: string): Promise<ExportedConvention[]> {
  let content: string

  if (source.startsWith('http://') || source.startsWith('https://')) {
    // Fetch from URL
    const response = await fetch(source)
    content = await response.text()
  } else {
    // Read from file
    const filePath = source.startsWith('/') ? source : path.join(projectRoot, source)
    content = await fs.readFile(filePath, 'utf-8')
  }

  // Detect format and parse
  if (source.endsWith('.json') || content.trim().startsWith('{')) {
    return fromJSON(content)
  } else if (source.endsWith('.yaml') || source.endsWith('.yml')) {
    return fromYAML(content)
  }

  // Try JSON first, then YAML
  const jsonResult = fromJSON(content)
  if (jsonResult.length > 0) {
    return jsonResult
  }

  return fromYAML(content)
}

/**
 * Diff conventions with external source
 */
async function diffConventions(source: string): Promise<ConventionDiff> {
  const [local, remote] = await Promise.all([loadConventions(), loadFromSource(source)])

  const localNames = new Set(local.map((c) => c.name))
  const remoteNames = new Set(remote.map((c) => c.name))

  const onlyLocal = local.filter((c) => !remoteNames.has(c.name)).map((c) => c.name)
  const onlyRemote = remote.filter((c) => !localNames.has(c.name)).map((c) => c.name)

  const different: ConventionDiff['different'] = []
  const identical: string[] = []

  for (const localConv of local) {
    const remoteConv = remote.find((r) => r.name === localConv.name)
    if (remoteConv) {
      if (localConv.severity !== remoteConv.severity) {
        different.push({name: localConv.name, localSeverity: localConv.severity, remoteSeverity: remoteConv.severity})
      } else {
        identical.push(localConv.name)
      }
    }
  }

  return {onlyLocal, onlyRemote, different, identical}
}

/**
 * Main handler for convention sync queries
 */
export async function handleConventionSyncQuery(args: SyncConventionsArgs) {
  const {query, source, format = 'json', merge = false} = args
  switch (query) {
    case 'export': {
      const conventions = await loadConventions()

      let output: string
      let filename: string
      let mimeType: string

      switch (format) {
        case 'yaml':
          output = toYAML(conventions)
          filename = 'conventions.yaml'
          mimeType = 'text/yaml'
          break
        case 'markdown':
          output = toMarkdown(conventions)
          filename = 'conventions.md'
          mimeType = 'text/markdown'
          break
        case 'json':
        default:
          output = toJSON(conventions)
          filename = 'conventions.json'
          mimeType = 'application/json'
      }

      return {
        format,
        filename,
        mimeType,
        totalConventions: conventions.length,
        bySeverity: {
          CRITICAL: conventions.filter((c) => c.severity === 'CRITICAL').length,
          HIGH: conventions.filter((c) => c.severity === 'HIGH').length,
          MEDIUM: conventions.filter((c) => c.severity === 'MEDIUM').length,
          LOW: conventions.filter((c) => c.severity === 'LOW').length
        },
        output
      }
    }

    case 'import': {
      if (!source) {
        return {
          error: 'Source required for import',
          examples: [
            {query: 'import', source: 'https://example.com/conventions.json'},
            {query: 'import', source: './external-conventions.yaml', merge: true}
          ]
        }
      }

      try {
        const imported = await loadFromSource(source)

        if (imported.length === 0) {
          return {source, message: 'No conventions found in source', imported: 0}
        }

        // For now, just return what would be imported
        // Actual merge would require writing to Conventions-Tracking.md
        return {
          source,
          imported: imported.length,
          conventions: imported.map((c) => ({name: c.name, severity: c.severity, category: c.category, description: c.description?.substring(0, 100)})),
          merge,
          note: merge
            ? 'Merge mode: Would add new conventions and update existing ones'
            : 'Replace mode: Would replace all conventions (use merge: true to preserve local)',
          nextStep: 'Review imported conventions and manually update docs/wiki/Meta/Conventions-Tracking.md'
        }
      } catch (error) {
        return {error: `Failed to load from source: ${error instanceof Error ? error.message : String(error)}`, source}
      }
    }

    case 'diff': {
      if (!source) {
        return {
          error: 'Source required for diff',
          examples: [
            {query: 'diff', source: 'https://example.com/conventions.json'},
            {query: 'diff', source: '../other-repo/conventions.yaml'}
          ]
        }
      }

      try {
        const diff = await diffConventions(source)

        const hasChanges = diff.onlyLocal.length > 0 || diff.onlyRemote.length > 0 || diff.different.length > 0

        return {
          source,
          hasChanges,
          summary: {
            onlyLocal: diff.onlyLocal.length,
            onlyRemote: diff.onlyRemote.length,
            different: diff.different.length,
            identical: diff.identical.length
          },
          details: {onlyLocal: diff.onlyLocal, onlyRemote: diff.onlyRemote, different: diff.different},
          recommendation: !hasChanges
            ? 'Conventions are in sync'
            : diff.onlyRemote.length > 0
            ? `Consider importing ${diff.onlyRemote.length} convention(s) from remote`
            : diff.different.length > 0
            ? `Review ${diff.different.length} convention(s) with different severities`
            : 'Local has additional conventions not in remote'
        }
      } catch (error) {
        return {error: `Failed to diff with source: ${error instanceof Error ? error.message : String(error)}`, source}
      }
    }

    default:
      return {
        error: `Unknown query type: ${query}`,
        availableQueries: ['import', 'export', 'diff'],
        availableFormats: ['json', 'yaml', 'markdown'],
        examples: [
          {query: 'export', format: 'json'},
          {query: 'export', format: 'markdown'},
          {query: 'import', source: './conventions.json'},
          {query: 'diff', source: 'https://example.com/conventions.json'}
        ]
      }
  }
}
