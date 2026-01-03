/**
 * Generate Convention Coverage Dashboard
 * Creates a comprehensive markdown dashboard showing convention coverage percentages by tool and severity.
 *
 * Outputs:
 * - Console (colorized)
 * - docs/convention-coverage-dashboard.md
 * - GitHub Actions summary (if GITHUB_STEP_SUMMARY set)
 */

import {readFileSync, readdirSync, writeFileSync, existsSync, appendFileSync} from 'node:fs'
import {join} from 'node:path'

interface Rule {
  name: string
  severity: string
  tool: string
}

const projectRoot = process.cwd()

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function colorize(text: string, color: keyof typeof colors): string {
  // Only colorize if not writing to file or CI
  if (process.env.GITHUB_STEP_SUMMARY || process.env.NO_COLOR) {
    return text
  }
  return `${colors[color]}${text}${colors.reset}`
}

function scanMcpRules(): Rule[] {
  const rulesDir = join(projectRoot, 'src/mcp/validation/rules')
  const rules: Rule[] = []

  if (existsSync(rulesDir)) {
    const files = readdirSync(rulesDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    for (const file of files) {
      const content = readFileSync(join(rulesDir, file), 'utf-8')
      // Match patterns like: SEVERITY = 'CRITICAL' or severity: 'CRITICAL' or severity: CRITICAL
      const severityMatch = content.match(/SEVERITY\s*=\s*['"]?(CRITICAL|HIGH|MEDIUM|LOW)['"]?/i) ||
        content.match(/severity[:\s]+['"]?(CRITICAL|HIGH|MEDIUM|LOW)['"]?/i)
      const severity = severityMatch ? severityMatch[1].toUpperCase() : 'MEDIUM'

      rules.push({
        name: file.replace('.ts', ''),
        severity,
        tool: 'MCP'
      })
    }
  }

  return rules
}

function scanEslintRules(): Rule[] {
  const rulesDir = join(projectRoot, 'eslint-local-rules/rules')
  const configPath = join(projectRoot, 'eslint.config.mjs')
  const rules: Rule[] = []

  if (existsSync(rulesDir)) {
    const files = readdirSync(rulesDir).filter((f) => f.endsWith('.cjs'))

    // Read config to check which are enabled
    const configContent = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : ''

    for (const file of files) {
      const ruleName = file.replace('.cjs', '')
      const isEnabled = configContent.includes(`'local-rules/${ruleName}'`)
      const severity = configContent.includes(`'local-rules/${ruleName}': 'error'`) ? 'CRITICAL' : 'HIGH'

      rules.push({
        name: ruleName,
        severity: isEnabled ? severity : 'DISABLED',
        tool: 'ESLint'
      })
    }
  }

  return rules
}

function scanGitHooks(): Rule[] {
  const huskyDir = join(projectRoot, '.husky')
  const rules: Rule[] = []

  if (existsSync(huskyDir)) {
    const hooks = readdirSync(huskyDir).filter((f) => !f.startsWith('_') && !f.startsWith('.'))
    for (const hook of hooks) {
      rules.push({
        name: hook,
        severity: 'HIGH',
        tool: 'Git Hooks'
      })
    }
  }

  return rules
}

function scanDependencyCruiser(): Rule[] {
  const dcPath = join(projectRoot, '.dependency-cruiser.cjs')
  const rules: Rule[] = []

  if (existsSync(dcPath)) {
    const content = readFileSync(dcPath, 'utf-8')
    // Extract rule names and severity from forbidden array
    const ruleBlocks = content.matchAll(/\{\s*name:\s*['"]([^'"]+)['"]/g)

    for (const match of ruleBlocks) {
      const name = match[1]
      // Check severity in the block following the name
      const blockStart = match.index || 0
      const blockText = content.slice(blockStart, blockStart + 200)
      const severityMatch = blockText.match(/severity:\s*['"]?(error|warn|info)['"]?/i)
      const severity = severityMatch?.input?.includes('error') ? 'CRITICAL' : 'HIGH'

      rules.push({
        name,
        severity,
        tool: 'Dependency Cruiser'
      })
    }
  }

  return rules
}

function generateDashboard(): string {
  const mcpRules = scanMcpRules()
  const eslintRules = scanEslintRules()
  const gitHooks = scanGitHooks()
  const depCruiser = scanDependencyCruiser()

  const allRules = [...mcpRules, ...eslintRules, ...gitHooks, ...depCruiser]
  const enabledRules = allRules.filter((r) => r.severity !== 'DISABLED')

  // Calculate stats
  const stats = {
    total: allRules.length,
    enabled: enabledRules.length,
    disabled: allRules.length - enabledRules.length,
    byTool: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>
  }

  for (const rule of enabledRules) {
    stats.byTool[rule.tool] = (stats.byTool[rule.tool] || 0) + 1
    stats.bySeverity[rule.severity] = (stats.bySeverity[rule.severity] || 0) + 1
  }

  const timestamp = new Date().toISOString().split('T')[0]

  let md = `# Convention Coverage Dashboard

*Generated: ${timestamp}*

## Summary

| Metric | Value |
|--------|-------|
| Total Rules | ${stats.total} |
| Enabled Rules | ${stats.enabled} |
| Disabled Rules | ${stats.disabled} |
| Coverage | ${((stats.enabled / stats.total) * 100).toFixed(1)}% |

## Enforcement by Tool

| Tool | Rules | Percentage |
|------|-------|------------|
`

  for (const [tool, count] of Object.entries(stats.byTool).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / stats.enabled) * 100).toFixed(1)
    md += `| ${tool} | ${count} | ${pct}% |\n`
  }

  md += `
## Enforcement by Severity

| Severity | Rules | Percentage |
|----------|-------|------------|
`

  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
    const count = stats.bySeverity[sev] || 0
    const pct = stats.enabled > 0 ? ((count / stats.enabled) * 100).toFixed(1) : '0'
    md += `| ${sev} | ${count} | ${pct}% |\n`
  }

  md += `
## MCP Rules (${mcpRules.length})

| Rule | Severity |
|------|----------|
`

  for (const rule of mcpRules.sort((a, b) => a.name.localeCompare(b.name))) {
    md += `| ${rule.name} | ${rule.severity} |\n`
  }

  md += `
## ESLint Rules (${eslintRules.length})

| Rule | Status |
|------|--------|
`

  for (const rule of eslintRules.sort((a, b) => a.name.localeCompare(b.name))) {
    const status = rule.severity === 'DISABLED' ? 'Disabled' : `Enabled (${rule.severity})`
    md += `| ${rule.name} | ${status} |\n`
  }

  md += `
## Git Hooks (${gitHooks.length})

| Hook | Severity |
|------|----------|
`

  for (const hook of gitHooks.sort((a, b) => a.name.localeCompare(b.name))) {
    md += `| ${hook.name} | ${hook.severity} |\n`
  }

  md += `
## Dependency Cruiser Rules (${depCruiser.length})

| Rule | Severity |
|------|----------|
`

  for (const rule of depCruiser.sort((a, b) => a.name.localeCompare(b.name))) {
    md += `| ${rule.name} | ${rule.severity} |\n`
  }

  md += `

---
*Dashboard generated by \`pnpm run dashboard:conventions\`*
`

  return md
}

function main() {
  console.log(colorize('Generating Convention Coverage Dashboard...\n', 'cyan'))

  const dashboard = generateDashboard()

  // Output to console
  console.log(dashboard)

  // Write to file
  const outputPath = join(projectRoot, 'docs/convention-coverage-dashboard.md')
  writeFileSync(outputPath, dashboard)
  console.log(colorize(`\nDashboard written to: ${outputPath}`, 'green'))

  // Write to GitHub Actions summary if available
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, dashboard)
    console.log(colorize('Dashboard added to GitHub Actions summary', 'green'))
  }
}

main()
