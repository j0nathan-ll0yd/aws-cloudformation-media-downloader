import * as esbuild from 'esbuild'
import {glob} from 'glob'
import * as fs from 'fs'

// Discover Lambda entry points dynamically
const lambdaEntryFiles = glob.sync('./src/lambdas/**/src/index.ts')

if (process.env['LOG_LEVEL']?.toUpperCase() === 'SILENT') {
  console.log = () => {}
}

// AWS SDK v3 is available in Lambda runtime - externalize to reduce bundle size
// Note: aws-xray-sdk-core is NOT in Lambda runtime - must be bundled
const awsSdkExternals = [
  '@aws-sdk/client-api-gateway',
  '@aws-sdk/client-cloudwatch',
  '@aws-sdk/client-dynamodb',
  '@aws-sdk/client-lambda',
  '@aws-sdk/client-s3',
  '@aws-sdk/client-sns',
  '@aws-sdk/client-sqs',
  '@aws-sdk/lib-dynamodb',
  '@aws-sdk/lib-storage',
  '@aws-sdk/util-dynamodb'
]

const isAnalyze = process.env['ANALYZE'] === 'true'

// ESM compatibility banner - provides require() for CJS dependencies
// Some packages (aws-xray-sdk-core, etc.) use dynamic require() which fails in ESM
const esmBanner = `
import { createRequire as __createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirname_fn } from 'path';
const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirname_fn(__filename);
`

async function build() {
  const startTime = Date.now()
  console.log(`Building ${lambdaEntryFiles.length} Lambda functions...`)

  // Ensure build directories exist
  fs.mkdirSync('build/lambdas', {recursive: true})
  if (isAnalyze) {
    fs.mkdirSync('build/reports', {recursive: true})
  }

  // Build all Lambdas in parallel for speed
  const results = await Promise.all(lambdaEntryFiles.map(async (entryFile) => {
    // Path is like "src/lambdas/WebhookFeedly/src/index.ts" or "./src/lambdas/WebhookFeedly/src/index.ts"
    const parts = entryFile.split('/')
    const lambdasIndex = parts.indexOf('lambdas')
    const functionName = parts[lambdasIndex + 1]

    const result = await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      platform: 'node',
      target: 'es2022', // Node.js 24 supports ES2022
      format: 'esm', // ESM for Node.js 24
      outfile: `build/lambdas/${functionName}.mjs`,
      outExtension: {'.js': '.mjs'}, // Explicit .mjs extension
      external: awsSdkExternals,
      minify: true,
      sourcemap: false,
      metafile: isAnalyze, // Generate metafile for bundle analysis
      treeShaking: true,
      // Prioritize ES modules for better tree-shaking
      mainFields: ['module', 'main'],
      // Resolve Node.js subpath imports from package.json
      conditions: ['import', 'node'],
      // Log level
      logLevel: 'warning',
      // Banner to provide CJS compatibility for ESM output
      banner: {js: esmBanner}
    })

    // Write metafile for bundle analysis
    if (result.metafile && isAnalyze) {
      fs.writeFileSync(`build/reports/${functionName}-meta.json`, JSON.stringify(result.metafile, null, 2))
    }

    // Get bundle size
    const stats = fs.statSync(`build/lambdas/${functionName}.mjs`)
    const sizeKb = (stats.size / 1024).toFixed(1)

    console.log(`  ${functionName}.mjs (${sizeKb} KB)`)

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
