/**
 * Bundle size checker for Lambda functions
 * Validates bundle sizes against configured limits for CI/CD
 *
 * Usage: pnpm run check:bundle-size
 */

import {readFileSync, readdirSync, statSync, existsSync, appendFileSync} from 'node:fs'
import {join} from 'node:path'

interface BundleLimits {
  globalLimit: number
  limits: Record<string, number>
  warningThreshold: number
}

interface BundleReport {
  lambda: string
  size: number
  limit: number
  percentage: number
  status: 'ok' | 'warning' | 'exceeded'
}

const BUILD_DIR = 'build/lambdas'
const LIMITS_FILE = 'config/bundle-limits.json'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const NC = '\x1b[0m'
const BOLD = '\x1b[1m'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

function getStatusIcon(status: BundleReport['status']): string {
  switch (status) {
    case 'exceeded':
      return `${RED}❌${NC}`
    case 'warning':
      return `${YELLOW}⚠️${NC}`
    case 'ok':
      return `${GREEN}✅${NC}`
  }
}

function checkBundleSizes(): void {
  const projectRoot = process.cwd()
  const buildDir = join(projectRoot, BUILD_DIR)
  const limitsFile = join(projectRoot, LIMITS_FILE)

  // Check if build directory exists
  if (!existsSync(buildDir)) {
    console.error(`${RED}Build directory not found: ${buildDir}${NC}`)
    console.error('Run "pnpm run build" first to generate Lambda bundles.')
    process.exit(1)
  }

  // Check if limits file exists
  if (!existsSync(limitsFile)) {
    console.error(`${RED}Bundle limits config not found: ${limitsFile}${NC}`)
    process.exit(1)
  }

  const limits: BundleLimits = JSON.parse(readFileSync(limitsFile, 'utf-8'))
  const reports: BundleReport[] = []
  let hasFailure = false
  let hasWarning = false

  // Find all Lambda build outputs (directories with index.mjs)
  const lambdaDirs = readdirSync(buildDir).filter((f) => {
    const lambdaPath = join(buildDir, f)
    return statSync(lambdaPath).isDirectory() && existsSync(join(lambdaPath, 'index.mjs'))
  })

  if (lambdaDirs.length === 0) {
    console.error(`${RED}No Lambda bundles found in ${buildDir}${NC}`)
    console.error('Run "pnpm run build" first to generate Lambda bundles.')
    process.exit(1)
  }

  for (const lambdaName of lambdaDirs) {
    const filePath = join(buildDir, lambdaName, 'index.mjs')
    const size = statSync(filePath).size
    const limit = limits.limits[lambdaName] ?? limits.globalLimit
    const percentage = size / limit

    let status: BundleReport['status'] = 'ok'
    if (percentage >= 1) {
      status = 'exceeded'
      hasFailure = true
    } else if (percentage >= limits.warningThreshold) {
      status = 'warning'
      hasWarning = true
    }

    reports.push({lambda: lambdaName, size, limit, percentage, status})
  }

  // Sort by percentage descending (largest relative size first)
  reports.sort((a, b) => b.percentage - a.percentage)

  // Output report
  console.log(`\n${BOLD}${CYAN}📦 Bundle Size Report${NC}\n`)
  console.log(`${BOLD}${'Lambda'.padEnd(30)} ${'Size'.padStart(10)} ${'Limit'.padStart(10)} ${'Usage'.padStart(8)} Status${NC}`)
  console.log('─'.repeat(70))

  for (const r of reports) {
    const sizeStr = formatBytes(r.size).padStart(10)
    const limitStr = formatBytes(r.limit).padStart(10)
    const pctStr = `${(r.percentage * 100).toFixed(1)}%`.padStart(8)
    const icon = getStatusIcon(r.status)
    const nameColor = r.status === 'exceeded' ? RED : r.status === 'warning' ? YELLOW : ''
    const nameReset = r.status !== 'ok' ? NC : ''

    console.log(`${nameColor}${r.lambda.padEnd(30)}${nameReset} ${sizeStr} ${limitStr} ${pctStr} ${icon}`)
  }

  console.log('─'.repeat(70))

  // Summary
  const totalSize = reports.reduce((sum, r) => sum + r.size, 0)
  const exceededCount = reports.filter((r) => r.status === 'exceeded').length
  const warningCount = reports.filter((r) => r.status === 'warning').length

  console.log(`\n${BOLD}Summary:${NC}`)
  console.log(`  Total bundles: ${reports.length}`)
  console.log(`  Total size: ${formatBytes(totalSize)}`)
  if (exceededCount > 0) {
    console.log(`  ${RED}Exceeded limits: ${exceededCount}${NC}`)
  }
  if (warningCount > 0) {
    console.log(`  ${YELLOW}Warnings: ${warningCount}${NC}`)
  }

  // GitHub Actions step summary
  if (process.env['GITHUB_STEP_SUMMARY']) {
    const summaryPath = process.env['GITHUB_STEP_SUMMARY']
    let summary = '## 📦 Bundle Size Report\n\n'
    summary += '| Lambda | Size | Limit | Usage | Status |\n'
    summary += '|--------|------|-------|-------|--------|\n'

    for (const r of reports) {
      const statusEmoji = r.status === 'exceeded' ? '❌' : r.status === 'warning' ? '⚠️' : '✅'
      summary += `| ${r.lambda} | ${formatBytes(r.size)} | ${formatBytes(r.limit)} | ${(r.percentage * 100).toFixed(1)}% | ${statusEmoji} |\n`
    }

    summary += `\n**Total size:** ${formatBytes(totalSize)}\n`

    if (exceededCount > 0) {
      summary += `\n⛔ **${exceededCount} bundle(s) exceeded size limits**\n`
    }
    if (warningCount > 0) {
      summary += `\n⚠️ **${warningCount} bundle(s) approaching limits (>${limits.warningThreshold * 100}%)**\n`
    }

    appendFileSync(summaryPath, summary)
  }

  // Exit status
  if (hasFailure) {
    console.log(`\n${RED}❌ Bundle size limits exceeded!${NC}`)
    console.log('Consider:')
    console.log('  - Reviewing dependencies for unused imports')
    console.log('  - Using dynamic imports for large optional dependencies')
    console.log('  - Increasing limit in config/bundle-limits.json if justified')
    process.exit(1)
  }

  if (hasWarning) {
    console.log(`\n${YELLOW}⚠️  Some bundles are approaching limits${NC}`)
  } else {
    console.log(`\n${GREEN}✅ All bundles within limits${NC}`)
  }

  process.exit(0)
}

checkBundleSizes()
