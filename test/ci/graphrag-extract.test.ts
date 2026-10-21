/**
 * Runs the real graphrag/extract.ts, with its real inputs, in two throwaway copies of the
 * project: one under a path that contains a space and one under a plain path. Before the entry
 * guard compared file system paths, `import.meta.url` (percent-encoded) never equalled
 * `file://${__filename}` (decoded) under such a path, so main() never ran: the script exited 0
 * and wrote nothing, and validate:graphrag passed over the committed graph without measuring.
 *
 * build/graph.json is gitignored and absent in CI's test job, so each copy gets an empty
 * dependency graph; both copies read the same inputs and must write the same graph.
 */
import {spawnSync} from 'node:child_process'
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {afterAll, describe, expect, test} from 'vitest'

const repoRoot = resolve(__dirname, '../..')

const created: string[] = []
afterAll(() => {
  for (const dir of created) {
    rmSync(dir, {recursive: true, force: true})
  }
})

/** A copy of everything extract.ts reads, with node_modules linked rather than copied. */
function projectCopy(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  created.push(dir)
  const root = join(dir, 'project')
  mkdirSync(join(root, 'graphrag'), {recursive: true})
  mkdirSync(join(root, 'build'))
  mkdirSync(join(root, 'src', 'db'), {recursive: true})
  cpSync(join(repoRoot, 'graphrag', 'extract.ts'), join(root, 'graphrag', 'extract.ts'))
  cpSync(join(repoRoot, 'graphrag', 'metadata.json'), join(root, 'graphrag', 'metadata.json'))
  cpSync(join(repoRoot, 'src', 'lambdas'), join(root, 'src', 'lambdas'), {recursive: true})
  cpSync(join(repoRoot, 'src', 'db', 'schema.ts'), join(root, 'src', 'db', 'schema.ts'))
  writeFileSync(join(root, 'build', 'graph.json'), JSON.stringify({transitiveDependencies: {}}))
  writeFileSync(join(root, 'package.json'), JSON.stringify({private: true, type: 'module'}))
  symlinkSync(join(repoRoot, 'node_modules'), join(root, 'node_modules'), 'dir')
  return root
}

function extract(root: string) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'graphrag/extract.ts'], {cwd: root, encoding: 'utf8'})
  const output = join(root, 'graphrag', 'knowledge-graph.json')
  return {result, graph: existsSync(output) ? readFileSync(output, 'utf8') : undefined}
}

describe('graphrag/extract.ts entry guard', () => {
  test('a checkout path with a space still runs the extraction, and the graph does not depend on the path', () => {
    const spaced = projectCopy('graphrag extract ')
    expect(spaced).toContain(' ')
    const plain = projectCopy('graphrag-extract-')

    const fromSpaced = extract(spaced)
    const fromPlain = extract(plain)

    expect(fromSpaced.result.status, fromSpaced.result.stderr).toBe(0)
    expect(fromPlain.result.status, fromPlain.result.stderr).toBe(0)
    expect(fromSpaced.result.stdout).toMatch(/Knowledge graph saved/)
    expect(fromSpaced.graph).toBeDefined()
    expect(fromSpaced.graph).toBe(fromPlain.graph)
    const nodes = (JSON.parse(fromSpaced.graph ?? '{}') as {nodes?: {type: string}[]}).nodes ?? []
    expect(nodes.filter((node) => node.type === 'Lambda').length).toBeGreaterThan(0)
  }, 120_000)
})
