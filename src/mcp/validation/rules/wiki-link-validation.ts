/**
 * Wiki Link Validation Rule
 * HIGH: Validates that markdown links in documentation files point to existing files
 *
 * This rule checks all markdown links in AGENTS.md and docs/wiki/ files
 * to ensure referenced files actually exist.
 *
 * @see docs/wiki/Meta/Documentation-Structure.md
 */

import fs from 'fs'
import path from 'path'
import type {SourceFile} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'wiki-link-validation'
const SEVERITY = 'HIGH' as const

/**
 * Regex to match markdown links: [text](path)
 * Captures the link text and the path
 */
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g

/**
 * Patterns to ignore (external URLs, anchors, etc.)
 */
const IGNORE_PATTERNS = [
  /^https?:\/\//, // External URLs
  /^mailto:/, // Email links
  /^#/, // Anchor-only links
  /^\.github\/ISSUE_TEMPLATE\//, // Issue templates (relative from repo root, may not exist during validation)
  /^data:/ // Data URLs
]

/**
 * Check if a link should be ignored
 */
function shouldIgnoreLink(linkPath: string): boolean {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(linkPath))
}

/**
 * Resolve a link path relative to the source file
 */
function resolveLinkPath(linkPath: string, sourceFilePath: string, projectRoot: string): string {
  // Remove any anchor from the path
  const pathWithoutAnchor = linkPath.split('#')[0]

  if (!pathWithoutAnchor) {
    // Link is anchor-only
    return ''
  }

  // Get the directory of the source file
  const sourceDir = path.dirname(path.join(projectRoot, sourceFilePath))

  // Resolve the link path relative to the source file
  return path.resolve(sourceDir, pathWithoutAnchor)
}

export const wikiLinkValidationRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Validates that markdown links in documentation files point to existing files',
  severity: SEVERITY,
  appliesTo: ['AGENTS.md', 'docs/wiki/**/*.md', 'CLAUDE.md'],
  excludes: [],

  validate(_sourceFile: SourceFile, filePath: string): Violation[] {
    // This rule validates based on file content, not AST
    void _sourceFile
    const violations: Violation[] = []

    // Get the project root (assuming validation runs from project root)
    const projectRoot = process.cwd()

    // Read the file content
    const fullPath = path.join(projectRoot, filePath)
    if (!fs.existsSync(fullPath)) {
      return violations
    }

    const content = fs.readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')

    // Track processed links to avoid duplicate violations
    const processedLinks = new Set<string>()

    // Check each line for markdown links
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]
      const lineNumber = lineIndex + 1

      // Reset regex lastIndex for each line
      MARKDOWN_LINK_REGEX.lastIndex = 0

      let match
      while ((match = MARKDOWN_LINK_REGEX.exec(line)) !== null) {
        const linkText = match[1]
        const linkPath = match[2]

        // Skip if we should ignore this link
        if (shouldIgnoreLink(linkPath)) {
          continue
        }

        // Create a unique key for this link
        const linkKey = `${filePath}:${linkPath}`
        if (processedLinks.has(linkKey)) {
          continue
        }
        processedLinks.add(linkKey)

        // Resolve the full path
        const resolvedPath = resolveLinkPath(linkPath, filePath, projectRoot)

        if (!resolvedPath) {
          // Anchor-only link, skip
          continue
        }

        // Check if the file exists
        if (!fs.existsSync(resolvedPath)) {
          violations.push(
            createViolation(RULE_NAME, SEVERITY, lineNumber, `Broken link: "${linkText}" points to non-existent file "${linkPath}"`, {
              suggestion: `Verify the file path exists. Expected: ${resolvedPath}`
            })
          )
        }
      }
    }

    return violations
  }
}

/**
 * Validate wiki links from filesystem (for shell scripts and CI)
 * Returns list of violations as strings
 */
export function validateWikiLinks(projectRoot: string, filePaths: string[]): string[] {
  const violations: string[] = []
  for (const filePath of filePaths) {
    const fullPath = path.join(projectRoot, filePath)
    if (!fs.existsSync(fullPath)) {
      violations.push(`File not found: ${filePath}`)
      continue
    }

    const content = fs.readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]
      const lineNumber = lineIndex + 1

      MARKDOWN_LINK_REGEX.lastIndex = 0

      let match
      while ((match = MARKDOWN_LINK_REGEX.exec(line)) !== null) {
        const linkText = match[1]
        const linkPath = match[2]

        if (shouldIgnoreLink(linkPath)) {
          continue
        }

        const resolvedPath = resolveLinkPath(linkPath, filePath, projectRoot)

        if (resolvedPath && !fs.existsSync(resolvedPath)) {
          violations.push(`${filePath}:${lineNumber}: Broken link "${linkText}" -> "${linkPath}"`)
        }
      }
    }
  }
  return violations
}
