/**
 * Report Enforcement Gaps
 * Compares documented conventions in Conventions-Tracking.md with actual enforcement implementations.
 *
 * Scans:
 * - MCP rules in src/mcp/validation/rules/
 * - ESLint rules in eslint-local-rules/rules/
 * - Git hooks in .husky/
 * - Dependency Cruiser rules in .dependency-cruiser.cjs
 *
 * Outputs:
 * - Convention coverage assessment
 * - Enforcement gap analysis
 * - Coverage statistics by severity
 */

import {readFileSync, readdirSync, existsSync} from 'node:fs'
import {join} from 'node:path'

interface Convention {
  name: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  enforcement: string[]
  documentedEnforcement: string
}

interface EnforcementSource {
  tool: string
  rules: string[]
}

const projectRoot = process.cwd()

function parseConventionsTracking(): Convention[] {
  const conventionsPath = join(projectRoot, 'docs/wiki/Meta/Conventions-Tracking.md')
  const content = readFileSync(conventionsPath, 'utf-8')

  const conventions: Convention[] = []

  // Split by section headings to identify severity
  const sections = content.split(/^###\s+/m)

  for (const section of sections) {
    // Determine severity from section heading
    let severity: Convention['severity'] = 'MEDIUM'
    if (section.startsWith('CRITICAL')) severity = 'CRITICAL'
    else if (section.startsWith('HIGH')) severity = 'HIGH'
    else if (section.startsWith('MEDIUM')) severity = 'MEDIUM'
    else if (section.startsWith('LOW')) severity = 'LOW'
    else continue // Skip non-severity sections

    // Find convention tables in this section
    // Pattern: | Convention | Documentation | Enforcement |
    const tableRegex = /\|\s*([^|]+?)\s*\|\s*\[[^\]]+\]\([^)]+\)\s*\|\s*([^|]+?)\s*\|/g
    let match

    while ((match = tableRegex.exec(section)) !== null) {
      const [, name, enforcement] = match

      // Skip header rows
      if (name === 'Convention' || name.includes('---') || !name.trim()) continue

      conventions.push({
        name: name.trim(),
        severity,
        enforcement: [],
        documentedEnforcement: enforcement.trim()
      })
    }
  }

  return conventions
}

function scanMcpRules(): EnforcementSource {
  const rulesDir = join(projectRoot, 'src/mcp/validation/rules')
  const rules: string[] = []

  if (existsSync(rulesDir)) {
    const files = readdirSync(rulesDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    for (const file of files) {
      const ruleName = file.replace('.ts', '')
      rules.push(ruleName)
    }
  }

  return {tool: 'MCP', rules}
}

function scanEslintRules(): EnforcementSource {
  const rulesDir = join(projectRoot, 'eslint-local-rules/rules')
  const rules: string[] = []

  if (existsSync(rulesDir)) {
    const files = readdirSync(rulesDir).filter((f) => f.endsWith('.cjs'))
    for (const file of files) {
      const ruleName = file.replace('.cjs', '')
      rules.push(ruleName)
    }
  }

  return {tool: 'ESLint', rules}
}

function scanGitHooks(): EnforcementSource {
  const huskyDir = join(projectRoot, '.husky')
  const rules: string[] = []

  if (existsSync(huskyDir)) {
    const hooks = readdirSync(huskyDir).filter((f) => !f.startsWith('_') && !f.startsWith('.'))
    rules.push(...hooks)
  }

  return {tool: 'Git Hooks', rules}
}

function scanDependencyCruiser(): EnforcementSource {
  const dcPath = join(projectRoot, '.dependency-cruiser.cjs')
  const rules: string[] = []

  if (existsSync(dcPath)) {
    const content = readFileSync(dcPath, 'utf-8')
    // Extract rule names from forbidden array
    const nameMatches = content.matchAll(/name:\s*['"]([^'"]+)['"]/g)
    for (const match of nameMatches) {
      rules.push(match[1])
    }
  }

  return {tool: 'Dependency Cruiser', rules}
}

function matchEnforcementToConventions(conventions: Convention[], sources: EnforcementSource[]): Convention[] {
  const enriched = conventions.map((conv) => ({...conv, enforcement: [...conv.enforcement]}))
  for (const source of sources) {
    for (const rule of source.rules) {
      // Try to match rule to convention
      const normalizedRule = rule.toLowerCase().replace(/[_-]/g, '')

      for (const conv of enriched) {
        const normalizedName = conv.name.toLowerCase().replace(/[_-\s]/g, '')

        // Check for direct matches or partial matches
        if (
          normalizedName.includes(normalizedRule) ||
          normalizedRule.includes(normalizedName) ||
          conv.documentedEnforcement.toLowerCase().includes(rule.toLowerCase())
        ) {
          if (!conv.enforcement.includes(source.tool)) {
            conv.enforcement.push(source.tool)
          }
        }
      }
    }
  }
  return enriched
}

function generateReport(conventions: Convention[], sources: EnforcementSource[]): void {
  console.log('# Convention Enforcement Gap Report\n')

  // Summary stats
  const total = conventions.length
  const enforced = conventions.filter((c) => c.enforcement.length > 0).length
  const gaps = total - enforced
  const gapPercentage = total > 0 ? ((gaps / total) * 100).toFixed(1) : '0'

  console.log('## Summary\n')
  console.log(`| Metric | Value |`)
  console.log(`|--------|-------|`)
  console.log(`| Total Documented Conventions | ${total} |`)
  console.log(`| Conventions with Enforcement | ${enforced} |`)
  console.log(`| Enforcement Gaps | ${gaps} |`)
  console.log(`| Gap Percentage | ${gapPercentage}% |`)

  // Enforcement tools
  console.log('\n## Enforcement Tools\n')
  console.log(`| Tool | Rules Count |`)
  console.log(`|------|-------------|`)
  for (const source of sources) {
    console.log(`| ${source.tool} | ${source.rules.length} |`)
  }

  // Coverage by severity
  console.log('\n## Coverage by Severity\n')
  const bySeverity: Record<string, {total: number; enforced: number}> = {}

  for (const conv of conventions) {
    const sev = conv.severity
    if (!bySeverity[sev]) {
      bySeverity[sev] = {total: 0, enforced: 0}
    }
    bySeverity[sev].total++
    if (conv.enforcement.length > 0) {
      bySeverity[sev].enforced++
    }
  }

  console.log(`| Severity | Total | Enforced | Coverage |`)
  console.log(`|----------|-------|----------|----------|`)
  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
    const stats = bySeverity[sev] || {total: 0, enforced: 0}
    const coverage = stats.total > 0 ? ((stats.enforced / stats.total) * 100).toFixed(0) : 'N/A'
    console.log(`| ${sev} | ${stats.total} | ${stats.enforced} | ${coverage}% |`)
  }

  // Gaps list
  const gapsConventions = conventions.filter((c) => c.enforcement.length === 0)
  if (gapsConventions.length > 0) {
    console.log('\n## Enforcement Gaps\n')
    console.log('Conventions without automated enforcement:\n')
    console.log(`| Convention | Severity | Documented Enforcement |`)
    console.log(`|------------|----------|------------------------|`)
    for (const conv of gapsConventions) {
      console.log(`| ${conv.name} | ${conv.severity} | ${conv.documentedEnforcement || 'None'} |`)
    }
  }

  // Enforced conventions
  const enforcedConventions = conventions.filter((c) => c.enforcement.length > 0)
  if (enforcedConventions.length > 0) {
    console.log('\n## Enforced Conventions\n')
    console.log(`| Convention | Severity | Enforcement Tools |`)
    console.log(`|------------|----------|-------------------|`)
    for (const conv of enforcedConventions) {
      console.log(`| ${conv.name} | ${conv.severity} | ${conv.enforcement.join(', ')} |`)
    }
  }
}

async function main() {
  console.log('Scanning enforcement sources...\n')

  // Scan all enforcement sources
  const mcpRules = scanMcpRules()
  const eslintRules = scanEslintRules()
  const gitHooks = scanGitHooks()
  const depCruiser = scanDependencyCruiser()

  const sources = [mcpRules, eslintRules, gitHooks, depCruiser]

  // Parse documented conventions
  const conventions = parseConventionsTracking()
  console.log(`Found ${conventions.length} documented conventions`)

  // Match enforcement to conventions
  const enrichedConventions = matchEnforcementToConventions(conventions, sources)

  // Generate report
  console.log('')
  generateReport(enrichedConventions, sources)
}

main().catch((error) => {
  console.error('Report generation failed:', error)
  process.exit(1)
})
