/**
 * Template loader utility for MCP handlers
 *
 * Loads template files from the templates directory and provides
 * simple placeholder interpolation.
 *
 * Convention: All code templates should be stored in external .template.txt
 * files rather than embedded as string literals in source code.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Cache for loaded templates to avoid repeated file reads
 */
const templateCache = new Map<string, string>()

/**
 * Load a template file from the templates directory
 *
 * @param templatePath - Relative path from templates directory (e.g., 'test-scaffold/entity-mock.template.txt')
 * @returns Template content as string
 */
export function loadTemplate(templatePath: string): string {
  if (templateCache.has(templatePath)) {
    return templateCache.get(templatePath)!
  }

  const fullPath = path.join(__dirname, templatePath)
  const content = fs.readFileSync(fullPath, 'utf-8')
  templateCache.set(templatePath, content)
  return content
}

/**
 * Interpolate placeholders in a template string
 *
 * Placeholders use Handlebars-style syntax: \{\{variableName\}\}
 *
 * @param template - Template string with placeholders
 * @param variables - Object with variable names and values
 * @returns Interpolated string
 *
 * @example
 * ```typescript
 * interpolate('Hello \{\{name\}\}!', {name: 'World'})
 * // Returns: 'Hello World!'
 * ```
 */
export function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
}

/**
 * Load and interpolate a template in one step
 *
 * @param templatePath - Relative path from templates directory
 * @param variables - Object with variable names and values
 * @returns Interpolated template content
 */
export function loadAndInterpolate(templatePath: string, variables: Record<string, string>): string {
  const template = loadTemplate(templatePath)
  return interpolate(template, variables)
}

/**
 * Clear the template cache (useful for testing)
 */
export function clearTemplateCache(): void {
  templateCache.clear()
}
