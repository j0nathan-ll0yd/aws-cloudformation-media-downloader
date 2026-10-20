// covers: cross-repo-contract#contract-drift-is-gated-and-tracked
/**
 * Spawns bin/check-openapi-freshness.sh inside a throwaway git repository with a fake `pnpm` on
 * PATH. The fake stands in for `pnpm run generate:openapi:spec`: it writes the committed bytes,
 * different bytes, nothing at all (the generator's exit-0 "no API handlers" path), or fails.
 * The script is copied into the throwaway repository, so it never touches this checkout's spec,
 * and every git call runs in an isolated git environment (test/helpers/git-sandbox.ts).
 */
import {spawnSync} from 'node:child_process'
import type {SpawnSyncReturns} from 'node:child_process'
import {createHash} from 'node:crypto'
import {chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {afterAll, describe, expect, test, vi} from 'vitest'
import {isolatedGitEnv} from '#test/helpers/git-sandbox'

type GeneratorMode = 'same' | 'changed' | 'none' | 'fail'

const script = resolve(__dirname, '../../bin/check-openapi-freshness.sh')
const COMMITTED = 'openapi: 3.1.0\ninfo:\n  title: Offline Media Downloader API\n  version: 1.0.0\npaths: {}\n'
const CHANGED = 'openapi: 3.1.0\ninfo:\n  title: Offline Media Downloader API\n  version: 1.0.0\npaths:\n  /files:\n    get: {}\n'

// A fake pnpm: logs its arguments, then acts as FAKE_PNPM_MODE says.
const FAKE_PNPM = `#!/usr/bin/env node
const fs = require('node:fs')
fs.appendFileSync(process.env.FAKE_PNPM_LOG, 'pnpm ' + process.argv.slice(2).join(' ') + '\\n')
const mode = process.env.FAKE_PNPM_MODE
if (mode === 'same') { fs.writeFileSync('docs/api/openapi.yaml', ${JSON.stringify(COMMITTED)}) }
if (mode === 'changed') { fs.writeFileSync('docs/api/openapi.yaml', ${JSON.stringify(CHANGED)}) }
if (mode === 'fail') { process.exit(7) }
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

// sha256 of every file under a directory, by relative path, to show that nothing in it changed.
function snapshot(dir: string): Record<string, string> {
  const files = readdirSync(dir, {recursive: true, encoding: 'utf8'}).filter((path) => statSync(join(dir, path)).isFile())
  return Object.fromEntries(files.sort().map((path) => [path, createHash('sha256').update(readFileSync(join(dir, path))).digest('hex')]))
}

function fixture({tracked = true}: {tracked?: boolean} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'openapi-freshness-'))
  created.push(dir)
  const repo = join(dir, 'repo')
  const specPath = join(repo, 'docs/api/openapi.yaml')
  const fakeBin = join(dir, 'fake-bin')
  mkdirSync(join(repo, 'bin'), {recursive: true})
  mkdirSync(join(repo, 'docs/api'), {recursive: true})
  mkdirSync(fakeBin)
  copyFileSync(script, join(repo, 'bin/check-openapi-freshness.sh'))
  writeFileSync(join(fakeBin, 'pnpm'), FAKE_PNPM)
  chmodSync(join(fakeBin, 'pnpm'), 0o755)
  writeFileSync(specPath, COMMITTED)
  writeFileSync(join(dir, 'pnpm.log'), '')
  git(repo, ['init', '-q'])
  if (tracked) {
    git(repo, ['add', 'docs/api/openapi.yaml'])
  }
  return {
    git: (args: string[]): void => git(repo, args),
    run(mode: GeneratorMode): SpawnSyncReturns<string> {
      const env = isolatedGitEnv({PATH: `${fakeBin}:${process.env.PATH ?? ''}`, FAKE_PNPM_MODE: mode, FAKE_PNPM_LOG: join(dir, 'pnpm.log')})
      return spawnSync('bash', ['bin/check-openapi-freshness.sh'], {cwd: repo, env, encoding: 'utf8'})
    },
    spec: (): string | undefined => (existsSync(specPath) ? readFileSync(specPath, 'utf8') : undefined),
    log: (): string => readFileSync(join(dir, 'pnpm.log'), 'utf8')
  }
}

describe('bin/check-openapi-freshness.sh', () => {
  test('a regenerated spec equal to the committed one passes, and the generator is the package script', () => {
    const f = fixture()
    const result = f.run('same')
    expect(result.status).toBe(0)
    expect(f.log()).toBe('pnpm run generate:openapi:spec\n')
    expect(f.spec()).toBe(COMMITTED)
  })

  test('a regenerated spec that differs fails, prints the difference and leaves the new file to commit', () => {
    const f = fixture()
    const result = f.run('changed')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/^\+ {2}\/files:$/m)
    expect(result.stdout).toMatch(/::error file=docs\/api\/openapi\.yaml::/)
    expect(f.spec()).toBe(CHANGED)
  })

  test('a generator that exits 0 without writing fails: the committed spec is deleted first', () => {
    const f = fixture()
    const result = f.run('none')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/^-paths: \{\}$/m)
    expect(result.stdout).toMatch(/wrote no docs\/api\/openapi\.yaml/)
    expect(f.spec()).toBeUndefined()
  })

  test('a failing generator fails the check', () => {
    const f = fixture()
    const result = f.run('fail')
    expect(result.status).toBe(7)
  })

  test('an untracked spec fails without running the generator, because it has no index blob', () => {
    const f = fixture({tracked: false})
    const result = f.run('same')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/is not tracked by git/)
    expect(f.log()).toBe('')
  })

  test('a stale spec marked assume-unchanged still fails, because the check compares blob hashes', () => {
    const f = fixture()
    f.git(['update-index', '--assume-unchanged', 'docs/api/openapi.yaml'])
    const result = f.run('changed')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/^\+ {2}\/files:$/m)
  })

  test.each([
    {shape: 'GIT_DIR', exportWorkTree: false},
    {shape: 'GIT_DIR and GIT_WORK_TREE', exportWorkTree: true}
  ])('an inherited $shape, as a hook in a linked worktree exports it, cannot reach that repository', ({exportWorkTree}) => {
    // Every Paseo checkout is a linked worktree. Hooks export its gitdir as GIT_DIR, and some
    // callers export GIT_WORK_TREE too. A fixture git call that inherited either would act on it.
    const decoy = mkdtempSync(join(tmpdir(), 'openapi-freshness-decoy-'))
    created.push(decoy)
    const outer = join(decoy, 'outer')
    const linked = join(decoy, 'linked')
    mkdirSync(outer)
    git(outer, ['init', '-q'])
    git(outer, ['-c', 'user.name=decoy', '-c', 'user.email=decoy@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'decoy'])
    git(outer, ['worktree', 'add', '-q', linked])
    const before = snapshot(decoy)
    vi.stubEnv('GIT_DIR', join(outer, '.git/worktrees/linked'))
    if (exportWorkTree) {
      vi.stubEnv('GIT_WORK_TREE', linked)
    }
    try {
      expect(fixture().run('same').status).toBe(0)
      expect(fixture().run('changed').status).toBe(1)
    } finally {
      vi.unstubAllEnvs()
    }
    expect(snapshot(decoy)).toEqual(before)
  })
})
