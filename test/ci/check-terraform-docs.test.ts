/**
 * Offline tests for the Terraform Docs Freshness job's two scripts.
 *
 * bin/check-terraform-docs.sh runs inside a throwaway git repository with a fake `terraform-docs`
 * on PATH, and runs the fixture's copy of the real `document:terraform` command, so the test also
 * pins that command's shape. A fake `pnpm` that fails loudly is on PATH too: the check must never
 * call pnpm, because `pnpm run` installs every dependency first when node_modules is missing, and
 * on the fleet that install fails for lack of the GitHub Packages login.
 *
 * bin/install-terraform-docs.sh runs with a fake `curl` and `uname`. Offline, only its refusals can
 * be tested: the real archives are needed for the success path, which the CI job exercises on
 * every run.
 */
import {spawnSync} from 'node:child_process'
import type {SpawnSyncReturns} from 'node:child_process'
import {chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join, resolve} from 'node:path'
import {afterAll, describe, expect, test} from 'vitest'
import {isolatedGitEnv} from '#test/helpers/git-sandbox'

type GeneratorMode = 'same' | 'changed' | 'empty' | 'fail'

const repoRoot = resolve(__dirname, '../..')
const checkScript = join(repoRoot, 'bin/check-terraform-docs.sh')
const installScript = join(repoRoot, 'bin/install-terraform-docs.sh')
const documentCommand = (JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {scripts: Record<string, string>}).scripts['document:terraform']
const COMMITTED = '## Requirements\n\n| Name | Version |\n| ---- | ------- |\n| terraform | >= 1.11.0 |\n'
const CHANGED = '## Requirements\n\n| Name | Version |\n| ---- | ------- |\n| terraform | >= 1.12.0 |\n'

// A fake terraform-docs: `--version` reports FAKE_TFDOCS_VERSION; `markdown infra/` prints per mode.
const FAKE_TERRAFORM_DOCS = `#!/usr/bin/env node
const fs = require('node:fs')
fs.appendFileSync(process.env.FAKE_LOG, 'terraform-docs ' + process.argv.slice(2).join(' ') + '\\n')
if (process.argv[2] === '--version') {
  process.stdout.write('terraform-docs version ' + process.env.FAKE_TFDOCS_VERSION + ' 9d44551 linux/arm64\\n')
} else {
  const mode = process.env.FAKE_TFDOCS_MODE
  if (mode === 'same') { process.stdout.write(${JSON.stringify(COMMITTED)}) }
  if (mode === 'changed') { process.stdout.write(${JSON.stringify(CHANGED)}) }
  if (mode === 'fail') { process.exitCode = 5 }
}
`

// A fake pnpm that records the call and fails, as the real one does on the fleet.
const FAKE_PNPM = `#!/bin/sh
echo "pnpm $*" >> "$FAKE_LOG"
exit 99
`

const created: string[] = []
afterAll(() => {
  for (const dir of created) {
    rmSync(dir, {recursive: true, force: true})
  }
})

function scratch(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  created.push(dir)
  return dir
}

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content)
  chmodSync(path, 0o755)
}

function git(cwd: string, args: string[]): void {
  const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {cwd, env: isolatedGitEnv(), encoding: 'utf8'})
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }
}

function checkFixture({tracked = true, command = documentCommand}: {tracked?: boolean; command?: string | null} = {}) {
  const dir = scratch('terraform-docs-check-')
  const repo = join(dir, 'repo')
  const docPath = join(repo, 'docs/terraform.md')
  const fakeBin = join(dir, 'fake-bin')
  for (const path of [join(repo, 'bin'), join(repo, 'docs'), join(repo, 'infra'), fakeBin]) {
    mkdirSync(path, {recursive: true})
  }
  copyFileSync(checkScript, join(repo, 'bin/check-terraform-docs.sh'))
  copyFileSync(installScript, join(repo, 'bin/install-terraform-docs.sh'))
  chmodSync(join(repo, 'bin/install-terraform-docs.sh'), 0o755)
  writeFileSync(join(repo, 'package.json'), JSON.stringify({private: true, scripts: command === null ? {} : {'document:terraform': command}}))
  writeFileSync(docPath, COMMITTED)
  writeExecutable(join(fakeBin, 'terraform-docs'), FAKE_TERRAFORM_DOCS)
  writeExecutable(join(fakeBin, 'pnpm'), FAKE_PNPM)
  writeFileSync(join(dir, 'fake.log'), '')
  git(repo, ['init', '-q'])
  if (tracked) {
    git(repo, ['add', 'docs/terraform.md'])
  }
  return {
    fakeBin,
    git: (args: string[]): void => git(repo, args),
    run(mode: GeneratorMode, extraEnv: Record<string, string> = {}): SpawnSyncReturns<string> {
      const env = isolatedGitEnv({
        PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
        FAKE_LOG: join(dir, 'fake.log'),
        FAKE_TFDOCS_MODE: mode,
        FAKE_TFDOCS_VERSION: 'v0.24.0',
        ...extraEnv
      })
      return spawnSync('bash', ['bin/check-terraform-docs.sh'], {cwd: repo, env, encoding: 'utf8'})
    },
    doc: (): string | undefined => (existsSync(docPath) ? readFileSync(docPath, 'utf8') : undefined),
    generated: (): boolean => readFileSync(join(dir, 'fake.log'), 'utf8').includes('terraform-docs markdown infra/'),
    pnpmCalled: (): boolean => readFileSync(join(dir, 'fake.log'), 'utf8').includes('pnpm ')
  }
}

describe('bin/check-terraform-docs.sh', () => {
  test('the pinned version is the installer pin, and the package script is the plain generator command', () => {
    const pin = spawnSync('bash', [installScript, '--version'], {encoding: 'utf8'})
    expect(pin.status).toBe(0)
    expect(pin.stdout.trim()).toMatch(/^v\d+\.\d+\.\d+$/)
    expect(documentCommand).toBe('terraform-docs markdown infra/ > docs/terraform.md')
  })

  test('a regenerated doc equal to the committed one passes, without calling pnpm', () => {
    const f = checkFixture()
    const result = f.run('same')
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/equals the terraform-docs v0\.24\.0 output/)
    expect(f.doc()).toBe(COMMITTED)
    expect(f.pnpmCalled()).toBe(false)
  })

  test('a regenerated doc that differs fails, prints the difference and leaves the new file to commit', () => {
    const f = checkFixture()
    const result = f.run('changed')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/^\+\| terraform \| >= 1\.12\.0 \|$/m)
    expect(result.stdout).toMatch(/::error file=docs\/terraform\.md::/)
    expect(f.doc()).toBe(CHANGED)
  })

  test('a generator that prints nothing fails', () => {
    const f = checkFixture()
    const result = f.run('empty')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/left docs\/terraform\.md empty or missing/)
  })

  test('a package script that writes no file fails: the committed doc is deleted first', () => {
    const f = checkFixture({command: 'true'})
    const result = f.run('same')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/empty or missing/)
    expect(f.doc()).toBeUndefined()
  })

  test('a terraform-docs version other than the pin is refused before generating', () => {
    const f = checkFixture()
    const result = f.run('same', {FAKE_TFDOCS_VERSION: 'v0.25.0'})
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/terraform-docs on PATH is v0\.25\.0; docs\/terraform\.md is generated with v0\.24\.0/)
    expect(f.generated()).toBe(false)
  })

  test('a missing terraform-docs is refused before generating', () => {
    const f = checkFixture()
    rmSync(join(f.fakeBin, 'terraform-docs'))
    // Only the fakes, node and the base system tools: a developer's own terraform-docs is not on it.
    const result = f.run('same', {PATH: `${f.fakeBin}:${dirname(process.execPath)}:/usr/bin:/bin`})
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/terraform-docs is not on PATH\. Install v0\.24\.0/)
    expect(f.generated()).toBe(false)
  })

  test('an untracked doc fails before generating, because it has no index blob', () => {
    const f = checkFixture({tracked: false})
    const result = f.run('same')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/is not tracked by git/)
    expect(f.generated()).toBe(false)
  })

  test('a failing generator fails the check with its exit status, and the error names the command', () => {
    const f = checkFixture()
    const result = f.run('fail')
    expect(result.status).toBe(5)
    expect(result.stdout).toContain(`::error::The document:terraform command (${documentCommand}) exited 5.`)
  })

  test('a package.json without the document:terraform script fails before generating', () => {
    const f = checkFixture({command: null})
    const result = f.run('same')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/package\.json has no document:terraform script/)
    expect(f.generated()).toBe(false)
  })

  test('a stale doc marked assume-unchanged still fails, because the check compares blob hashes', () => {
    const f = checkFixture()
    f.git(['update-index', '--assume-unchanged', 'docs/terraform.md'])
    expect(f.run('changed').status).toBe(1)
  })
})

// A fake curl: copies FAKE_CURL_ARCHIVE to the -o path, or fails as `curl -f` does on HTTP 404.
const FAKE_CURL = `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
fs.appendFileSync(process.env.FAKE_LOG, 'curl ' + args.join(' ') + '\\n')
if (process.env.FAKE_CURL_FAIL === '1') { process.exitCode = 22; return }
fs.copyFileSync(process.env.FAKE_CURL_ARCHIVE, args[args.indexOf('-o') + 1])
`

// A fake uname: -s and -m report the platform under test.
const FAKE_UNAME = `#!/bin/sh
case "$1" in
  -s) echo "$FAKE_UNAME_S" ;;
  -m) echo "$FAKE_UNAME_M" ;;
esac
`

function installFixture() {
  const dir = scratch('terraform-docs-install-')
  const fakeBin = join(dir, 'fake-bin')
  const payload = join(dir, 'payload')
  mkdirSync(fakeBin)
  mkdirSync(payload)
  writeExecutable(join(fakeBin, 'curl'), FAKE_CURL)
  writeExecutable(join(fakeBin, 'uname'), FAKE_UNAME)
  // An archive shaped like the real one, whose checksum cannot match the pin.
  writeExecutable(join(payload, 'terraform-docs'), '#!/bin/sh\necho "terraform-docs version v0.24.0 tampered"\n')
  const tar = spawnSync('tar', ['-czf', join(dir, 'archive.tar.gz'), '-C', payload, 'terraform-docs'], {encoding: 'utf8'})
  if (tar.status !== 0) {
    throw new Error(`tar failed: ${tar.stderr}`)
  }
  writeFileSync(join(dir, 'fake.log'), '')
  const dest = join(dir, 'dest')
  return {
    dest,
    run(extraEnv: Record<string, string> = {}, args: string[] = [dest]): SpawnSyncReturns<string> {
      const env = {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
        FAKE_LOG: join(dir, 'fake.log'),
        FAKE_CURL_ARCHIVE: join(dir, 'archive.tar.gz'),
        FAKE_UNAME_S: 'Linux',
        FAKE_UNAME_M: 'aarch64',
        ...extraEnv
      }
      return spawnSync('bash', [installScript, ...args], {env, encoding: 'utf8'})
    },
    curlCalls: (): number => readFileSync(join(dir, 'fake.log'), 'utf8').split('\n').filter((line) => line.startsWith('curl ')).length
  }
}

describe('bin/install-terraform-docs.sh', () => {
  test('--version prints the pin without downloading anything', () => {
    const f = installFixture()
    const result = f.run({}, ['--version'])
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('v0.24.0\n')
    expect(f.curlCalls()).toBe(0)
  })

  test('an archive whose sha256 differs from the pin is refused and nothing is installed', () => {
    const f = installFixture()
    const result = f.run()
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/terraform-docs-v0\.24\.0-linux-arm64\.tar\.gz has sha256 [0-9a-f]{64}, not the pinned d12bd7b7/)
    expect(existsSync(join(f.dest, 'terraform-docs'))).toBe(false)
  })

  test('a platform with no pinned checksum is refused before any download', () => {
    const f = installFixture()
    const result = f.run({FAKE_UNAME_S: 'FreeBSD', FAKE_UNAME_M: 'riscv64'})
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/no pinned checksum for unsupported-unsupported/)
    expect(f.curlCalls()).toBe(0)
  })

  test('a failed download fails the install and installs nothing', () => {
    const f = installFixture()
    const result = f.run({FAKE_CURL_FAIL: '1'})
    expect(result.status).not.toBe(0)
    expect(existsSync(join(f.dest, 'terraform-docs'))).toBe(false)
  })

  test('a missing directory argument is a usage error', () => {
    const f = installFixture()
    expect(f.run({}, []).status).toBe(1)
  })
})
