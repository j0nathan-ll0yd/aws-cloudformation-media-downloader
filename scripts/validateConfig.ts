/**
 * Configuration validation script for CI
 * Validates config files against project conventions using MCP validation rules
 *
 * Usage: pnpm run validate:config
 */

import * as path from 'node:path'
import {configEnforcementRule} from '../src/mcp/validation/rules/config-enforcement'
import {Project} from 'ts-morph'

const CONFIG_FILES = ['eslint.config.mjs', 'tsconfig.json', 'dprint.json']

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const NC = '\x1b[0m'

async function main() {
  const projectRoot = process.cwd()
  const project = new Project({skipFileDependencyResolution: true})

  console.log(`${YELLOW}Validating configuration files...${NC}\n`)

  const allViolations: {file: string; line: number; severity: string; message: string; suggestion?: string}[] = []

  for (const configFile of CONFIG_FILES) {
    const filePath = path.join(projectRoot, configFile)

    try {
      const sourceFile = project.addSourceFileAtPath(filePath)
      const violations = configEnforcementRule.validate(sourceFile, configFile)

      for (const violation of violations) {
        allViolations.push({
          file: configFile,
          line: violation.line,
          severity: violation.severity,
          message: violation.message,
          suggestion: violation.suggestion
        })
      }
    } catch {
      // File doesn't exist or can't be parsed - skip
      console.log(`${YELLOW}Skipping ${configFile} (not found or unreadable)${NC}`)
    }
  }

  if (allViolations.length > 0) {
    console.log(`${RED}Configuration enforcement violations detected:${NC}\n`)

    for (const v of allViolations) {
      const severityColor = v.severity === 'CRITICAL' ? RED : YELLOW
      console.log(`${severityColor}[${v.severity}]${NC} ${v.file}:${v.line}`)
      console.log(`  ${v.message}`)
      if (v.suggestion) {
        console.log(`  ${GREEN}Suggestion:${NC} ${v.suggestion}`)
      }
      console.log()
    }

    console.log(`${RED}Found ${allViolations.length} violation(s). Fix these before committing.${NC}`)
    process.exit(1)
  }

  console.log(`${GREEN}All configuration files pass enforcement checks${NC}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(`${RED}Validation script failed:${NC}`, error)
  process.exit(1)
})
