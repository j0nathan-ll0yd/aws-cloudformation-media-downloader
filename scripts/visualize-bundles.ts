/**
 * Generates bundle visualization from esbuild metafiles
 * Creates an HTML report showing bundle composition for all Lambda functions
 */
import * as fs from 'fs'
import {glob} from 'glob'

interface MetafileInput {
  bytes: number
  imports: {path: string; kind: string}[]
}

interface MetafileOutput {
  bytes: number
  inputs: Record<string, {bytesInOutput: number}>
}

interface Metafile {
  inputs: Record<string, MetafileInput>
  outputs: Record<string, MetafileOutput>
}

interface BundleInfo {
  name: string
  totalBytes: number
  inputs: {path: string; bytes: number}[]
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }
  return `${(bytes / 1024).toFixed(1)} KB`
}

async function main() {
  const metafiles = glob.sync('build/reports/*-meta.json')

  if (metafiles.length === 0) {
    console.error('No metafiles found. Run ANALYZE=true pnpm run build first.')
    process.exit(1)
  }

  const bundles: BundleInfo[] = []

  for (const metafilePath of metafiles) {
    const name = metafilePath.replace('build/reports/', '').replace('-meta.json', '')
    const metafile: Metafile = JSON.parse(fs.readFileSync(metafilePath, 'utf8'))

    // Get the output file info
    const outputKey = Object.keys(metafile.outputs).find(k => k.endsWith('.js'))
    if (!outputKey) continue

    const output = metafile.outputs[outputKey]
    const inputs = Object.entries(output.inputs)
      .map(([path, info]) => ({path, bytes: info.bytesInOutput}))
      .filter(i => i.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes)

    bundles.push({
      name,
      totalBytes: output.bytes,
      inputs
    })
  }

  // Sort bundles by size
  bundles.sort((a, b) => b.totalBytes - a.totalBytes)

  // Generate HTML report
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Lambda Bundle Analysis</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #4fc3f7; }
    h2 { color: #81c784; margin-top: 30px; border-bottom: 1px solid #333; padding-bottom: 10px; }
    .summary { background: #16213e; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat { background: #0f3460; padding: 15px; border-radius: 6px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #4fc3f7; }
    .stat-label { color: #aaa; font-size: 14px; }
    table { border-collapse: collapse; width: 100%; margin-top: 15px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #333; }
    th { background: #0f3460; color: #4fc3f7; }
    tr:hover { background: #16213e; }
    .bytes { text-align: right; font-family: monospace; color: #ffd700; }
    .path { color: #aaa; font-size: 12px; }
    .node-modules { color: #ff6b6b; }
    .src { color: #81c784; }
    .bar { height: 6px; background: #4fc3f7; border-radius: 3px; margin-top: 5px; }
    details { margin-top: 10px; }
    summary { cursor: pointer; color: #4fc3f7; }
  </style>
</head>
<body>
  <h1>Lambda Bundle Analysis</h1>
  <div class="summary">
    <div class="summary-grid">
      <div class="stat">
        <div class="stat-value">${bundles.length}</div>
        <div class="stat-label">Lambda Functions</div>
      </div>
      <div class="stat">
        <div class="stat-value">${formatBytes(bundles.reduce((sum, b) => sum + b.totalBytes, 0))}</div>
        <div class="stat-label">Total Bundle Size</div>
      </div>
      <div class="stat">
        <div class="stat-value">${formatBytes(bundles.length > 0 ? bundles.reduce((sum, b) => sum + b.totalBytes, 0) / bundles.length : 0)}</div>
        <div class="stat-label">Average Bundle Size</div>
      </div>
      <div class="stat">
        <div class="stat-value">${formatBytes(Math.max(...bundles.map(b => b.totalBytes)))}</div>
        <div class="stat-label">Largest Bundle</div>
      </div>
    </div>
  </div>

  ${bundles.map(bundle => {
    const topInputs = bundle.inputs.slice(0, 20)
    const remaining = bundle.inputs.slice(20)
    const nodeModulesBytes = bundle.inputs.filter(i => i.path.includes('node_modules')).reduce((sum, i) => sum + i.bytes, 0)
    const srcBytes = bundle.inputs.filter(i => !i.path.includes('node_modules')).reduce((sum, i) => sum + i.bytes, 0)

    return `
  <h2>${bundle.name} <span style="font-weight: normal; color: #aaa;">(${formatBytes(bundle.totalBytes)})</span></h2>
  <div style="margin-bottom: 15px;">
    <span class="node-modules">node_modules: ${formatBytes(nodeModulesBytes)} (${((nodeModulesBytes / bundle.totalBytes) * 100).toFixed(1)}%)</span> |
    <span class="src">src: ${formatBytes(srcBytes)} (${((srcBytes / bundle.totalBytes) * 100).toFixed(1)}%)</span>
  </div>
  <table>
    <tr><th>Module</th><th class="bytes">Size</th><th style="width: 200px;">%</th></tr>
    ${topInputs.map(input => {
      const pct = (input.bytes / bundle.totalBytes) * 100
      const isNodeModules = input.path.includes('node_modules')
      return `<tr>
        <td class="${isNodeModules ? 'node-modules' : 'src'}">${input.path}</td>
        <td class="bytes">${formatBytes(input.bytes)}</td>
        <td><div class="bar" style="width: ${pct}%"></div> ${pct.toFixed(1)}%</td>
      </tr>`
    }).join('')}
  </table>
  ${remaining.length > 0 ? `
  <details>
    <summary>${remaining.length} more files (${formatBytes(remaining.reduce((sum, i) => sum + i.bytes, 0))})</summary>
    <table>
      <tr><th>Module</th><th class="bytes">Size</th></tr>
      ${remaining.map(input => `<tr>
        <td class="${input.path.includes('node_modules') ? 'node-modules' : 'src'}">${input.path}</td>
        <td class="bytes">${formatBytes(input.bytes)}</td>
      </tr>`).join('')}
    </table>
  </details>
  ` : ''}`
  }).join('')}

  <footer style="margin-top: 40px; color: #666; font-size: 12px;">
    Generated at ${new Date().toISOString()} by esbuild bundle analyzer
  </footer>
</body>
</html>`

  fs.writeFileSync('build/reports/bundle-analysis.html', html)
  console.log('Bundle analysis written to build/reports/bundle-analysis.html')
  console.log(`\nBundle Summary:`)
  bundles.forEach(b => {
    console.log(`  ${b.name}: ${formatBytes(b.totalBytes)}`)
  })
}

main().catch(console.error)
