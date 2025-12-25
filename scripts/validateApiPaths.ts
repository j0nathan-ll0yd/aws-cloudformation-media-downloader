import * as fs from 'node:fs'
import * as path from 'node:path'
import {glob} from 'glob'

interface ApiPath {
  path: string
  method: string
  source: 'typespec' | 'terraform'
}

interface TerraformResource {
  pathPart: string
  parentRef: string | null
  resourceName: string
  file: string
}

interface TerraformMethod {
  resourceName: string
  httpMethod: string
  file: string
}

/**
 * Extract API paths from the generated OpenAPI spec using regex parsing
 * (avoids YAML dependency for this simple extraction task)
 */
async function extractTypeSpecPaths(projectRoot: string): Promise<ApiPath[]> {
  const openapiPath = path.join(projectRoot, 'docs/api/openapi.yaml')

  if (!fs.existsSync(openapiPath)) {
    throw new Error('OpenAPI spec not found at docs/api/openapi.yaml. Run pnpm run document-api first.')
  }

  const content = fs.readFileSync(openapiPath, 'utf-8')
  const paths: ApiPath[] = []

  // Parse OpenAPI YAML structure using regex
  const lines = content.split('\n')
  let currentPath: string | null = null

  for (const line of lines) {
    // Check for path definition (2-space indent)
    const pathDef = line.match(/^ {2}(\/[a-z0-9/-]+):$/)
    if (pathDef) {
      currentPath = pathDef[1]
      continue
    }

    // Check for method definition (4-space indent under current path)
    if (currentPath && line.match(/^ {4}(get|post|put|delete|patch):$/)) {
      const method = line.trim().replace(':', '').toUpperCase()
      paths.push({
        path: currentPath,
        method,
        source: 'typespec'
      })
    }

    // Reset current path when we hit a non-indented line that's not empty
    if (line.match(/^[a-z]/) || line === 'paths:' || line === 'components:' || line === 'servers:') {
      if (line !== 'paths:') {
        currentPath = null
      }
    }
  }

  return paths
}

/**
 * Parse Terraform files to extract API Gateway resource and method configurations
 */
async function extractTerraformResources(projectRoot: string): Promise<{resources: TerraformResource[], methods: TerraformMethod[]}> {
  const terraformDir = path.join(projectRoot, 'terraform')
  const tfFiles = await glob('*.tf', {cwd: terraformDir})
  const resources: TerraformResource[] = []
  const methods: TerraformMethod[] = []

  for (const tfFile of tfFiles) {
    const content = fs.readFileSync(path.join(terraformDir, tfFile), 'utf-8')

    // Extract aws_api_gateway_resource blocks
    const resourceRegex = /resource\s+"aws_api_gateway_resource"\s+"(\w+)"\s+\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g
    let match

    while ((match = resourceRegex.exec(content)) !== null) {
      const resourceName = match[1]
      const block = match[2]

      // Extract path_part
      const pathPartMatch = block.match(/path_part\s*=\s*"([^"]+)"/)
      // Extract parent_id reference
      const parentMatch = block.match(/parent_id\s*=\s*([^\n]+)/)

      if (pathPartMatch) {
        let parentRef: string | null = null
        if (parentMatch) {
          const parentValue = parentMatch[1].trim()
          // Check if parent is root or another resource
          if (parentValue.includes('root_resource_id')) {
            parentRef = null // Root level
          } else {
            // Extract resource reference like aws_api_gateway_resource.User.id
            const refMatch = parentValue.match(/aws_api_gateway_resource\.(\w+)\.id/)
            if (refMatch) {
              parentRef = refMatch[1]
            }
          }
        }

        resources.push({
          pathPart: pathPartMatch[1],
          parentRef,
          resourceName,
          file: tfFile
        })
      }
    }

    // Extract aws_api_gateway_method blocks to get HTTP methods
    const methodRegex = /resource\s+"aws_api_gateway_method"\s+"(\w+)"\s+\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g

    while ((match = methodRegex.exec(content)) !== null) {
      const methodBlock = match[2]
      const httpMethodMatch = methodBlock.match(/http_method\s*=\s*"(\w+)"/)
      const resourceIdMatch = methodBlock.match(/resource_id\s*=\s*aws_api_gateway_resource\.(\w+)\.id/)

      if (httpMethodMatch && resourceIdMatch) {
        methods.push({
          resourceName: resourceIdMatch[1],
          httpMethod: httpMethodMatch[1],
          file: tfFile
        })
      }
    }
  }

  return {resources, methods}
}

/**
 * Build full paths from Terraform resources by resolving parent references
 */
function buildTerraformPaths(resources: TerraformResource[], methods: TerraformMethod[]): ApiPath[] {
  const resourceMap = new Map(resources.map(r => [r.resourceName, r]))
  const paths: ApiPath[] = []

  for (const method of methods) {
    const resource = resourceMap.get(method.resourceName)
    if (!resource) continue

    // Build full path by traversing parent chain
    const pathParts: string[] = [resource.pathPart]
    let current = resource

    while (current.parentRef) {
      const parent = resourceMap.get(current.parentRef)
      if (parent) {
        pathParts.unshift(parent.pathPart)
        current = parent
      } else {
        break
      }
    }

    paths.push({
      path: '/' + pathParts.join('/'),
      method: method.httpMethod,
      source: 'terraform'
    })
  }

  return paths
}

/**
 * Compare TypeSpec and Terraform paths
 */
function comparePaths(typespecPaths: ApiPath[], terraformPaths: ApiPath[]): {
  matched: Array<{path: string, method: string}>
  missingInTerraform: ApiPath[]
  missingInTypespec: ApiPath[]
} {
  const matched: Array<{path: string, method: string}> = []
  const missingInTerraform: ApiPath[] = []
  const missingInTypespec: ApiPath[] = []

  // Create sets for comparison
  const terraformSet = new Set(terraformPaths.map(p => `${p.method} ${p.path}`))
  const typespecSet = new Set(typespecPaths.map(p => `${p.method} ${p.path}`))

  // Find paths in TypeSpec but not in Terraform
  for (const tsp of typespecPaths) {
    const key = `${tsp.method} ${tsp.path}`
    if (terraformSet.has(key)) {
      matched.push({path: tsp.path, method: tsp.method})
    } else {
      missingInTerraform.push(tsp)
    }
  }

  // Find paths in Terraform but not in TypeSpec
  for (const tf of terraformPaths) {
    const key = `${tf.method} ${tf.path}`
    if (!typespecSet.has(key)) {
      missingInTypespec.push(tf)
    }
  }

  return {matched, missingInTerraform, missingInTypespec}
}

async function main() {
  const projectRoot = process.cwd()

  console.log('Validating API path alignment between TypeSpec and Terraform...\n')

  // Extract paths from both sources
  const typespecPaths = await extractTypeSpecPaths(projectRoot)
  const {resources, methods} = await extractTerraformResources(projectRoot)
  const terraformPaths = buildTerraformPaths(resources, methods)

  console.log(`TypeSpec paths found: ${typespecPaths.length}`)
  console.log(`Terraform paths found: ${terraformPaths.length}\n`)

  // Compare paths
  const {matched, missingInTerraform, missingInTypespec} = comparePaths(typespecPaths, terraformPaths)

  // Report results
  console.log('--- Path Alignment Summary ---\n')

  if (matched.length > 0) {
    console.log(`Matched paths (${matched.length}):`)
    for (const m of matched.sort((a, b) => a.path.localeCompare(b.path))) {
      console.log(`  [MATCH] ${m.method} ${m.path}`)
    }
    console.log()
  }

  if (missingInTerraform.length > 0) {
    console.log(`Paths in TypeSpec but NOT in Terraform (${missingInTerraform.length}):`)
    for (const m of missingInTerraform.sort((a, b) => a.path.localeCompare(b.path))) {
      console.log(`  [MISSING IN TF] ${m.method} ${m.path}`)
    }
    console.log()
  }

  if (missingInTypespec.length > 0) {
    console.log(`Paths in Terraform but NOT in TypeSpec (${missingInTypespec.length}):`)
    for (const m of missingInTypespec.sort((a, b) => a.path.localeCompare(b.path))) {
      console.log(`  [MISSING IN TSP] ${m.method} ${m.path}`)
    }
    console.log()
  }

  // Exit with error if there are mismatches
  const totalMismatches = missingInTerraform.length + missingInTypespec.length

  if (totalMismatches > 0) {
    console.log(`\nAPI path validation FAILED: ${totalMismatches} mismatches found.`)
    console.log('Ensure TypeSpec definitions in tsp/ match Terraform in terraform/')
    process.exit(1)
  } else {
    console.log('\nAPI path validation PASSED: All paths are aligned!')
  }
}

main().catch((error) => {
  console.error('API path validation failed:', error)
  process.exit(1)
})
