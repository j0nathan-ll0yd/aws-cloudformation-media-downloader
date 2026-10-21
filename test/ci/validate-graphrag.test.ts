/**
 * Spawns bin/validate-graphrag.sh inside a throwaway git repository with a fake `pnpm` on PATH.
 * The fake stands in for `graphrag:validate`, `mantle generate graph` and `graphrag:extract`; the
 * extract step writes the committed graph, a different graph, or nothing at all (extract.ts
 * exits 0 without writing when its entry guard does not match the checkout path). The script is
 * copied into the throwaway repository, so it never touches this checkout's graph.
 */
import {spawnSync} from 'node:child_process'
import type {SpawnSyncReturns} from 'node:child_process'
import {chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {afterAll, describe, expect, test} from 'vitest'
import {isolatedGitEnv} from '#test/helpers/git-sandbox'

type ExtractMode = 'same' | 'changed' | 'none'

const script = resolve(__dirname, '../../bin/validate-graphrag.sh')
const COMMITTED = '{"nodes":[{"id":"lambda:ListFiles"}],"edges":[]}\n'
const CHANGED = '{"nodes":[{"id":"lambda:ListFiles"},{"id":"lambda:NewLambda"}],"edges":[]}\n'

// A fake pnpm: logs its arguments. FAKE_METADATA=fail fails `graphrag:validate`; FAKE_EXTRACT
// decides what `graphrag:extract` writes.
const FAKE_PNPM = `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2).join(' ')
fs.appendFileSync(process.env.FAKE_PNPM_LOG, 'pnpm ' + args + '\\n')
if (args === 'run graphrag:validate' && process.env.FAKE_METADATA === 'fail') { process.exit(1) }
if (args === 'exec mantle generate graph') { fs.mkdirSync('build', {recursive: true}); fs.writeFileSync('build/graph.json', '{}') }
if (args === 'run graphrag:extract') {
  if (process.env.FAKE_EXTRACT === 'same') { fs.writeFileSync('graphrag/knowledge-graph.json', ${JSON.stringify(COMMITTED)}) }
  if (process.env.FAKE_EXTRACT === 'changed') { fs.writeFileSync('graphrag/knowledge-graph.json', ${JSON.stringify(CHANGED)}) }
}
`

const created: string[] = []
afterAll(() => {
  for (const dir of created) {
    rmSync(dir, {recursive: true, force: true})
  }
})

function git(cwd: string, args: string[]): void {
  const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {cwd, env: isolatedGitEnv(), encoding: 'utf8'})
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'validate-graphrag-'))
  created.push(dir)
  const repo = join(dir, 'repo')
  const graphPath = join(repo, 'graphrag/knowledge-graph.json')
  const fakeBin = join(dir, 'fake-bin')
  mkdirSync(join(repo, 'bin'), {recursive: true})
  mkdirSync(join(repo, 'graphrag'), {recursive: true})
  mkdirSync(fakeBin)
  copyFileSync(script, join(repo, 'bin/validate-graphrag.sh'))
  writeFileSync(join(fakeBin, 'pnpm'), FAKE_PNPM)
  chmodSync(join(fakeBin, 'pnpm'), 0o755)
  writeFileSync(graphPath, COMMITTED)
  writeFileSync(join(dir, 'pnpm.log'), '')
  git(repo, ['init', '-q'])
  git(repo, ['add', 'graphrag/knowledge-graph.json'])
  return {
    run(extract: ExtractMode, extraEnv: Record<string, string> = {}): SpawnSyncReturns<string> {
      const env = isolatedGitEnv({PATH: `${fakeBin}:${process.env.PATH ?? ''}`, FAKE_EXTRACT: extract, FAKE_PNPM_LOG: join(dir, 'pnpm.log'), ...extraEnv})
      return spawnSync('bash', ['bin/validate-graphrag.sh'], {cwd: repo, env, encoding: 'utf8'})
    },
    graph: (): string | undefined => (existsSync(graphPath) ? readFileSync(graphPath, 'utf8') : undefined),
    log: (): string => readFileSync(join(dir, 'pnpm.log'), 'utf8')
  }
}

describe('bin/validate-graphrag.sh', () => {
  test('a regenerated graph equal to the committed one passes', () => {
    const f = fixture()
    const result = f.run('same')
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/GraphRAG is up to date/)
    expect(f.log()).toBe('pnpm run graphrag:validate\npnpm exec mantle generate graph\npnpm run graphrag:extract\n')
  })

  test('a regenerated graph that differs fails', () => {
    const f = fixture()
    const result = f.run('changed')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/knowledge-graph\.json is out of date/)
    expect(f.graph()).toBe(CHANGED)
  })

  test('an extract step that exits 0 without writing fails: the committed graph is deleted first', () => {
    const f = fixture()
    const result = f.run('none')
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/wrote no graphrag\/knowledge-graph\.json/)
    expect(f.graph()).toBeUndefined()
  })

  test('a metadata validation failure fails before the graph is extracted', () => {
    const f = fixture()
    const result = f.run('same', {FAKE_METADATA: 'fail'})
    expect(result.status).toBe(1)
    expect(f.log()).toBe('pnpm run graphrag:validate\n')
  })
})
