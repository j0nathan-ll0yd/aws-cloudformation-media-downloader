/**
 * Tests the git sandbox helper itself. The variable list comes from git, and a git that cannot
 * give it fails closed instead of handing every caller the inherited environment.
 */
import {chmodSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterAll, afterEach, describe, expect, test, vi} from 'vitest'
import {gitLocalEnvVars, isolatedGitEnv} from '#test/helpers/git-sandbox'

const created: string[] = []
afterAll(() => {
  for (const dir of created) {
    rmSync(dir, {recursive: true, force: true})
  }
})
afterEach(() => {
  vi.unstubAllEnvs()
})

// A directory for PATH whose git, if `script` is given, runs that shell script.
function fakeGitDir(script?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'git-sandbox-'))
  created.push(dir)
  if (script !== undefined) {
    writeFileSync(join(dir, 'git'), `#!/bin/sh\n${script}\n`)
    chmodSync(join(dir, 'git'), 0o755)
  }
  return dir
}

describe('test/helpers/git-sandbox.ts', () => {
  test('removes every variable git lists as repository-local, the config pairs and the unlisted scoping variables', () => {
    const listed = gitLocalEnvVars()
    expect(listed).toEqual(
      expect.arrayContaining(['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT'])
    )
    const planted = [...listed, 'GIT_NAMESPACE', 'GIT_CEILING_DIRECTORIES', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0']
    for (const name of planted) {
      vi.stubEnv(name, '/planted')
    }
    const env = isolatedGitEnv({EXTRA: 'kept'})
    expect(Object.entries(env).filter(([name, value]) => value !== undefined && planted.includes(name))).toEqual([])
    expect(env).toMatchObject({GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', EXTRA: 'kept', PATH: process.env.PATH})
  })

  test('fails closed when git lists no GIT_DIR, exits non-zero or is not on PATH', () => {
    const noGitDir = fakeGitDir("printf 'GIT_WORK_TREE\\nGIT_INDEX_FILE\\n'")
    expect(() => gitLocalEnvVars({...process.env, PATH: noGitDir})).toThrow(/did not list GIT_DIR \(status 0\)/)
    const failing = fakeGitDir("printf 'GIT_DIR\\n'; exit 1")
    expect(() => gitLocalEnvVars({...process.env, PATH: failing})).toThrow(/did not list GIT_DIR \(status 1\)/)
    expect(() => gitLocalEnvVars({...process.env, PATH: fakeGitDir()})).toThrow(/did not list GIT_DIR \(status null\): .*ENOENT/)
  })
})
