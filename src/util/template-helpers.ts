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
  const templatePath = join(__dirname, '../templates/github-issues', `${templateName}.md`)
  const template = readFileSync(templatePath, 'utf-8')

  // Use Function constructor for safe template evaluation
  // This allows full JavaScript expressions in templates
  const fn = new Function(...Object.keys(data), `return \`${template}\``)
  return fn(...Object.values(data))
}
