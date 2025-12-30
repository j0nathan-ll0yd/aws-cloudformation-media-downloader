import {readFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Render a GitHub issue template with variable interpolation.
 *
 * Uses safe explicit variable replacement instead of dynamic function creation.
 * This prevents potential code injection if template content were ever
 * attacker-influenced.
 *
 * Templates should use \$\{variableName\} syntax for placeholders.
 *
 * @param templateName - Name of template file (without .md extension)
 * @param data - Variables to inject into the template
 * @returns Rendered template string
 */
export function renderGithubIssueTemplate(templateName: string, data: Record<string, unknown>): string {
  // Use relative path from the new location (src/lib/integrations/github) to templates (src/templates)
  const templatePath = join(__dirname, '../../../templates/github-issues', `${templateName}.md`)
  let template = readFileSync(templatePath, 'utf-8')

  // Safe explicit variable replacement - no dynamic code execution
  for (const [key, value] of Object.entries(data)) {
    // Match ${variableName} patterns for this specific variable
    const placeholder = new RegExp(`\\$\\{${key}\\}`, 'g')
    template = template.replace(placeholder, String(value ?? ''))
  }

  return template
}
