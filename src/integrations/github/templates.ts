import {existsSync, readFileSync} from 'fs'
import {join} from 'path'

/**
 * Get the template path, checking multiple locations.
 * In Lambda: /var/task/templates/github-issues/<name>.md (copied by esbuild)
 * In development/test: src/templates/github-issues/<name>.md
 */
function getTemplatePath(templateName: string): string {
  const basePath = process.cwd()
  const fileName = `${templateName}.md`

  // Lambda path (templates copied to build output by esbuild config)
  const lambdaPath = join(basePath, 'templates/github-issues', fileName)
  if (existsSync(lambdaPath)) {
    return lambdaPath
  }

  // Development/test path (source location)
  const devPath = join(basePath, 'src/templates/github-issues', fileName)
  if (existsSync(devPath)) {
    return devPath
  }

  // Fallback - let readFileSync throw a more descriptive error
  return lambdaPath
}

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
  const templatePath = getTemplatePath(templateName)
  let template = readFileSync(templatePath, 'utf-8')

  // Safe explicit variable replacement - no dynamic code execution
  for (const [key, value] of Object.entries(data)) {
    // Match ${variableName} patterns for this specific variable
    const placeholder = new RegExp(`\\$\\{${key}\\}`, 'g')
    template = template.replace(placeholder, String(value ?? ''))
  }

  return template
}
