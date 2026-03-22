import * as esbuild from 'esbuild'
import {glob} from 'glob'
import * as fs from 'fs'

// Discover Lambda entry points dynamically
// API handlers use file-system routing: src/lambdas/api/<path>/<file>.<method>.ts
// Non-API handlers use directory structure: src/lambdas/<type>/<Name>/index.ts
const apiEntryFiles = glob.sync('./src/lambdas/api/**/*.{get,post,put,delete,patch}.ts')
const nonApiEntryFiles = glob.sync('./src/lambdas/{sqs,s3,scheduled,standalone}/**/index.ts')
const lambdaEntryFiles = [...apiEntryFiles, ...nonApiEntryFiles]

if (process.env['LOG_LEVEL']?.toUpperCase() === 'SILENT') {
  console.log = () => {}
}

// AWS SDK v3 is available in Lambda runtime - externalize to reduce bundle size
const awsSdkExternals = [
  '@aws-sdk/client-api-gateway',
  '@aws-sdk/client-cloudwatch-logs',
  '@aws-sdk/client-dynamodb',
  '@aws-sdk/client-eventbridge',
  '@aws-sdk/client-lambda',
  '@aws-sdk/client-s3',
  '@aws-sdk/client-sns',
  '@aws-sdk/client-sqs',
  '@aws-sdk/dsql-signer',
  '@aws-sdk/lib-dynamodb',
  '@aws-sdk/lib-storage'
]

const isAnalyze = process.env['ANALYZE'] === 'true'

async function build() {
  const startTime = Date.now()
  console.log(`Building ${lambdaEntryFiles.length} Lambda functions...`)

  // Delete stale zip files so Terraform regenerates them from fresh build output
  // This prevents Terraform from using cached zips with old code
  const staleZips = glob.sync('./build/lambdas/*.zip')
  if (staleZips.length > 0) {
    for (const zipFile of staleZips) {
      fs.unlinkSync(zipFile)
    }
    console.log(`Deleted ${staleZips.length} stale zip files`)
  }

  // Ensure build directories exist
  fs.mkdirSync('build/lambdas', {recursive: true})
  if (isAnalyze) {
    fs.mkdirSync('build/reports', {recursive: true})
  }

  // Build all Lambdas in parallel for speed
  const results = await Promise.all(lambdaEntryFiles.map(async (entryFile) => {
    // Derive Lambda function name from path
    // API: ./src/lambdas/api/files/index.get.ts -> ListFiles
    // API: ./src/lambdas/api/user/login.post.ts -> LoginUser
    // Non-API: ./src/lambdas/sqs/StartFileUpload/index.ts -> StartFileUpload
    const parts = entryFile.split('/')
    const lambdasIndex = parts.indexOf('lambdas')
    const lambdaType = parts[lambdasIndex + 1]
    let functionName: string
    if (lambdaType === 'api') {
      // API handler: derive name from path + method
      // e.g., api/files/index.get.ts -> ListFiles, api/user/login.post.ts -> LoginUser
      // Names must match what `mantle generate infra` produces
      const apiNameMap: Record<string, string> = {
        'files/index.get': 'FilesGet',
        'user/login.post': 'UserLogin',
        'user/logout.post': 'UserLogout',
        'user/register.post': 'UserRegister',
        'user/refresh.post': 'UserRefresh',
        'user/index.delete': 'UserDelete',
        'user/subscribe.post': 'UserSubscribe',
        'device/register.post': 'DeviceRegister',
        'device/event.post': 'DeviceEvent',
        'feedly/webhook.post': 'FeedlyWebhook'
      }
      const relativePath = parts.slice(lambdasIndex + 2).join('/').replace(/\.ts$/, '')
      functionName = apiNameMap[relativePath] ?? relativePath.replace(/\//g, '-')
    } else {
      // Non-API: directory name is the function name
      functionName = parts[lambdasIndex + 2]
    }

    // Create subdirectory for each Lambda (for packaging with collector.yaml)
    const lambdaDir = `build/lambdas/${functionName}`
    fs.mkdirSync(lambdaDir, {recursive: true})

    const result = await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      platform: 'node',
      target: 'node24', // Node.js 24 Lambda runtime
      format: 'esm', // ESM for Node.js 24
      outfile: `${lambdaDir}/index.mjs`,
      outExtension: {'.js': '.mjs'}, // Explicit .mjs extension
      external: awsSdkExternals,
      minify: true,
      legalComments: 'none', // Strip license comments from minified output
      drop: ['debugger'], // Remove debugger statements in production
      charset: 'utf8', // Explicit UTF-8 encoding
      sourcemap: false,
      metafile: isAnalyze, // Generate metafile for bundle analysis
      treeShaking: true,
      // Prioritize ES modules for better tree-shaking
      mainFields: ['module', 'main'],
      // Prefer ESM exports to avoid CJS require() calls in pure ESM bundles
      // 'module' condition matches @aws/lambda-invoke-store ESM export
      conditions: ['module', 'import'],
      // Log level
      logLevel: 'warning'
    })

    // Copy OTEL collector config to Lambda directory for packaging
    // This config fixes: "service::telemetry::metrics::address is being deprecated"
    // Upstream issue: ADOT Lambda layer v1.30.2 uses deprecated collector config format
    // See: https://github.com/aws-observability/aws-otel-lambda/issues/1039
    // When ADOT layer is updated with fixed config, this custom collector.yaml can be removed
    // and OPENTELEMETRY_COLLECTOR_CONFIG_URI env var can be deleted from infra/main.tf
    fs.copyFileSync('config/otel-collector.yaml', `${lambdaDir}/collector.yaml`)

    // Copy migration SQL files for MigrateDSQL Lambda
    // These files are read at runtime to apply database schema changes
    if (functionName === 'MigrateDSQL') {
      const migrationsDir = `${lambdaDir}/migrations`
      fs.mkdirSync(migrationsDir, {recursive: true})
      const migrationFiles = fs.readdirSync('migrations').filter((f: string) => f.endsWith('.sql'))
      for (const file of migrationFiles) {
        fs.copyFileSync(`migrations/${file}`, `${migrationsDir}/${file}`)
      }
      console.log(`    Copied ${migrationFiles.length} migration files`)
    }

    // Copy GitHub issue templates for Lambdas that create issues
    // StartFileUpload: cookie expiration, video download failure
    // UserDelete: user deletion failure
    const lambdasNeedingTemplates = ['StartFileUpload', 'UserDelete']
    if (lambdasNeedingTemplates.includes(functionName)) {
      const templatesDir = `${lambdaDir}/templates/github-issues`
      fs.mkdirSync(templatesDir, {recursive: true})
      const templateFiles = fs.readdirSync('src/templates/github-issues').filter((f: string) => f.endsWith('.md'))
      for (const file of templateFiles) {
        fs.copyFileSync(`src/templates/github-issues/${file}`, `${templatesDir}/${file}`)
      }
      console.log(`    Copied ${templateFiles.length} template files`)
    }

    // Write metafile for bundle analysis
    if (result.metafile && isAnalyze) {
      fs.writeFileSync(`build/reports/${functionName}-meta.json`, JSON.stringify(result.metafile, null, 2))
    }

    // Get bundle size
    const stats = fs.statSync(`${lambdaDir}/index.mjs`)
    const sizeKb = (stats.size / 1024).toFixed(1)

    console.log(`  ${functionName}/index.mjs (${sizeKb} KB)`)

    return {functionName, size: stats.size, metafile: result.metafile}
  }))

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)
  const totalSize = results.reduce((sum, r) => sum + r.size, 0)
  const totalSizeMb = (totalSize / 1024 / 1024).toFixed(2)

  console.log(`\nBuilt ${results.length} Lambda functions in ${totalTime}s`)
  console.log(`Total bundle size: ${totalSizeMb} MB`)

  if (isAnalyze) {
    console.log(`\nBundle analysis metafiles written to build/reports/`)
  }
}

build().catch((e) => {
  console.error('Build failed:', e)
  process.exit(1)
})
