import {readFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Render a GitHub issue template with variable interpolation
 * Uses native JavaScript template literals for full expression support
 * @param templateName - Name of template file (without .md extension)
 * @param data - Variables to inject into the template
 * @returns Rendered template string
 */
export function renderGithubIssueTemplate(templateName: string, data: Record<string, unknown>): string {
  // Use relative path from the new location (src/lib/integrations/github) to templates (src/templates)
  const templatePath = join(__dirname, '../../../templates/github-issues', `${templateName}.md`)
  const template = readFileSync(templatePath, 'utf-8')

  // Escape backticks to prevent breaking the generated function's template literal
  const safeTemplate = template.replace(/`/g, '`')

  // Use Function constructor for safe template evaluation
  // This allows full JavaScript expressions in templates
  const fn = new Function(...Object.keys(data), 'return `' + safeTemplate + '`')
  return fn(...Object.values(data))
}
