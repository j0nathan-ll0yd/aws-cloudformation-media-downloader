// covers: cross-repo-contract#contract-drift-is-gated-and-tracked
/**
 * Spawns bin/check-api-contract-sync.sh against fixture specs with a fake `gh` on PATH. The fake
 * keeps an issue store in a JSON file, so each test observes the issue state the script leaves
 * behind, not only its exit code. Offline: no GitHub call leaves the machine.
 */
import {spawnSync} from 'node:child_process'
import type {SpawnSyncReturns} from 'node:child_process'
import {chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {afterAll, describe, expect, test} from 'vitest'

interface Issue {
  number: number
  state: 'OPEN' | 'CLOSED'
  author: {login: string}
  body: string
}

const script = resolve(__dirname, '../../bin/check-api-contract-sync.sh')
const MARKER = '<!-- api-contract-sync:managed -->'
// The login gh reports for an issue opened with GITHUB_TOKEN.
const BOT = 'app/github-actions'

// A fake gh: `issue list|create|edit|reopen|close` against a JSON store. Every call is logged.
// `list` honours --limit like the real gh. FAKE_GH_FAIL=<subcommand> makes that subcommand fail.
// FAKE_GH_AUTHOR is the login that `create` records (default: the GITHUB_TOKEN bot).
const FAKE_GH = `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
fs.appendFileSync(process.env.FAKE_GH_LOG, 'gh ' + args.join(' ') + '\\n')
const store = () => JSON.parse(fs.readFileSync(process.env.FAKE_GH_STORE, 'utf8'))
const save = (issues) => fs.writeFileSync(process.env.FAKE_GH_STORE, JSON.stringify(issues))
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1] }
const valued = new Set(['--repo', '--state', '--limit', '--json', '--title', '--comment', '--body-file'])
const positional = args.slice(2).filter((a, i, all) => !a.startsWith('--') && !valued.has(all[i - 1]))
const number = Number(positional[0])
const sub = args[1]
if (args[0] !== 'issue') { process.exit(2) }
if (process.env.FAKE_GH_FAIL === sub) { console.error('HTTP 502'); process.exit(1) }
if (sub === 'list') {
  process.stdout.write(JSON.stringify(store().slice(0, Number(flag('--limit')))))
} else if (sub === 'create') {
  const issues = store()
  const next = Math.max(0, ...issues.map((i) => i.number)) + 1
  const login = process.env.FAKE_GH_AUTHOR || '${BOT}'
  issues.push({number: next, state: 'OPEN', author: {login}, body: fs.readFileSync(flag('--body-file'), 'utf8')})
  save(issues)
} else if (sub === 'edit') {
  save(store().map((i) => (i.number === number ? {...i, body: fs.readFileSync(flag('--body-file'), 'utf8')} : i)))
} else if (sub === 'reopen' || sub === 'close') {
  save(store().map((i) => (i.number === number ? {...i, state: sub === 'reopen' ? 'OPEN' : 'CLOSED'} : i)))
} else {
  process.exit(2)
}
`

const SPEC_A = 'openapi: 3.1.0\ninfo:\n  title: Offline Media Downloader API\n  version: 1.0.0\npaths: {}\n'
const SPEC_B = 'openapi: 3.1.0\ninfo:\n  title: Offline Media Downloader API\n  version: 1.0.0\npaths:\n  /files:\n    get: {}\n'

const created: string[] = []
afterAll(() => {
  for (const dir of created) {
    rmSync(dir, {recursive: true, force: true})
  }
})

function issue(number: number, body: string, state: Issue['state'] = 'OPEN', login: string = BOT): Issue {
  return {number, state, author: {login}, body}
}

function fixture(issues: Issue[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'api-contract-sync-'))
  created.push(dir)
  const bin = join(dir, 'bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'gh'), FAKE_GH)
  chmodSync(join(bin, 'gh'), 0o755)
  writeFileSync(join(dir, 'a.yaml'), SPEC_A)
  writeFileSync(join(dir, 'b.yaml'), SPEC_B)
  writeFileSync(join(dir, 'store.json'), JSON.stringify(issues))
  writeFileSync(join(dir, 'gh.log'), '')
  return {
    dir,
    run(backend: string, vendored: string, extraEnv: Record<string, string> = {}, args?: string[]): SpawnSyncReturns<string> {
      const env = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        FAKE_GH_STORE: join(dir, 'store.json'),
        FAKE_GH_LOG: join(dir, 'gh.log'),
        GITHUB_REPOSITORY: 'j0nathan-ll0yd/mantle-OfflineMediaDownloader',
        BACKEND_LABEL: 'main @ aaaaaaaaaaaa',
        VENDORED_LABEL: 'main @ bbbbbbbbbbbb',
        ...extraEnv
      }
      return spawnSync('bash', [script, ...(args ?? [join(dir, backend), join(dir, vendored)])], {env, encoding: 'utf8'})
    },
    issues: (): Issue[] => JSON.parse(readFileSync(join(dir, 'store.json'), 'utf8')) as Issue[],
    log: (): string => readFileSync(join(dir, 'gh.log'), 'utf8')
  }
}

const managed = (issues: Issue[], login: string = BOT) => issues.filter((entry) => entry.author.login === login && entry.body.includes(MARKER))
const MUTATION = /issue (create|edit|close|reopen)/

describe('bin/check-api-contract-sync.sh', () => {
  test('in sync with no issue: exit 0 and no mutation', () => {
    const f = fixture()
    const result = f.run('a.yaml', 'a.yaml')
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/^In sync: /m)
    expect(f.log()).not.toMatch(MUTATION)
  })

  test('drift creates exactly one issue that cites the sync script; a second run edits it', () => {
    const f = fixture([issue(1, 'unrelated', 'OPEN', 'j0nathan-ll0yd')])
    expect(f.run('b.yaml', 'a.yaml').status).toBe(0)
    expect(f.run('b.yaml', 'a.yaml').status).toBe(0)
    expect(managed(f.issues())).toHaveLength(1)
    expect(f.log().match(/issue create/g)).toHaveLength(1)
    expect(f.log()).toMatch(/issue edit 2 /)
    expect(f.issues()[0]).toEqual(issue(1, 'unrelated', 'OPEN', 'j0nathan-ll0yd'))
    const body = f.issues()[1]?.body ?? ''
    expect(body.startsWith(MARKER)).toBe(true)
    expect(body).toContain('bash Scripts/sync-openapi.sh')
    expect(body).toMatch(/3 lines added, 1 lines removed/)
  })

  test('sync closes the tracking issue; renewed drift edits it, then reopens it, with no new issue', () => {
    const f = fixture([issue(5, `${MARKER}\nold`)])
    expect(f.run('a.yaml', 'a.yaml').status).toBe(0)
    expect(f.issues()[0]?.state).toBe('CLOSED')
    expect(f.log()).toMatch(/issue close 5 /)
    expect(f.run('b.yaml', 'a.yaml').status).toBe(0)
    expect(f.issues()).toHaveLength(1)
    expect(f.issues()[0]?.state).toBe('OPEN')
    expect(f.issues()[0]?.body).toContain('bash Scripts/sync-openapi.sh')
    expect(f.log()).not.toMatch(/issue create/)
    const log = f.log()
    expect(log.indexOf('issue edit 5 ')).toBeGreaterThan(-1)
    expect(log.indexOf('issue edit 5 ')).toBeLessThan(log.indexOf('issue reopen 5 '))
  })

  test('two open managed issues: the lowest number is kept and the other is closed as a duplicate', () => {
    const f = fixture([issue(4, `${MARKER}\na`), issue(7, `${MARKER}\nb`)])
    expect(f.run('b.yaml', 'a.yaml').status).toBe(0)
    expect(f.issues()[0]?.state).toBe('OPEN')
    expect(f.issues()[1]?.state).toBe('CLOSED')
    expect(f.log()).toMatch(/issue close 7 .*Duplicate of #4/)
    expect(f.log()).toMatch(/issue edit 4 /)
  })

  test('a marker in an issue opened by anyone else is ignored and left untouched', () => {
    const foreign = issue(3, `${MARKER}\nplanted by another account`, 'OPEN', 'someone-else')
    const f = fixture([foreign])
    expect(f.run('b.yaml', 'a.yaml').status).toBe(0)
    expect(f.log()).toMatch(/issue create/)
    expect(f.log()).not.toMatch(/issue (edit|close|reopen) 3 /)
    expect(f.issues()[0]).toEqual(foreign)
    expect(managed(f.issues()).map((entry) => entry.number)).toEqual([4])
    expect(f.run('a.yaml', 'a.yaml').status).toBe(0)
    expect(f.issues()[0]).toEqual(foreign)
    expect(f.issues()[1]?.state).toBe('CLOSED')
  })

  test('an issue the workflow token opened without the marker is never the tracking issue, open or closed', () => {
    // The updater-failure and cookie-refresh workflows open issues with the same token, unmarked.
    const unmarked = [issue(2, 'ffmpeg update workflow failed', 'CLOSED'), issue(3, 'YouTube cookie refresh failed')]
    const f = fixture(unmarked)
    expect(f.run('a.yaml', 'a.yaml').status).toBe(0)
    expect(f.run('b.yaml', 'a.yaml').status).toBe(0)
    expect(f.run('a.yaml', 'a.yaml').status).toBe(0)
    expect(f.log()).not.toMatch(/issue (edit|close|reopen) [23] /)
    expect(f.issues().slice(0, 2)).toEqual(unmarked)
    expect(managed(f.issues()).map((entry) => entry.number)).toEqual([4])
    expect(f.issues()[2]?.state).toBe('CLOSED')
  })

  test('unmeasured inputs exit 3, never 0, and mutate nothing', () => {
    const f = fixture()
    writeFileSync(join(f.dir, 'empty.yaml'), '')
    writeFileSync(join(f.dir, 'not-openapi.yaml'), 'hello: world\n')
    expect(f.run('empty.yaml', 'a.yaml').status).toBe(3)
    expect(f.run('a.yaml', 'not-openapi.yaml').status).toBe(3)
    expect(f.run('missing.yaml', 'a.yaml').status).toBe(3)
    expect(f.run('b.yaml', 'a.yaml', {}, ['only-one-argument']).status).toBe(3)
    expect(f.run('b.yaml', 'a.yaml', {BACKEND_LABEL: ''}).status).toBe(3)
    expect(f.run('b.yaml', 'a.yaml', {VENDORED_LABEL: ''}).status).toBe(3)
    expect(f.run('b.yaml', 'a.yaml', {FAKE_GH_FAIL: 'list'}).status).toBe(3)
    expect(f.log()).not.toMatch(MUTATION)
  })

  test('a DRY_RUN value other than "true" or "false", empty included, is refused before any GitHub call', () => {
    const f = fixture()
    for (const value of ['1', '', 'TRUE']) {
      const result = f.run('b.yaml', 'a.yaml', {DRY_RUN: value})
      expect(result.status).toBe(3)
      expect(result.stdout).toMatch(/UNMEASURED: DRY_RUN must be/)
    }
    expect(f.log()).toBe('')
  })

  test('an issue list that reaches the limit is unmeasured, because the tracking issue may lie outside it', () => {
    const f = fixture(Array.from({length: 1000}, (_, index) => issue(index + 1, 'unrelated', 'CLOSED', 'j0nathan-ll0yd')))
    const result = f.run('b.yaml', 'a.yaml')
    expect(result.status).toBe(3)
    expect(result.stdout).toMatch(/UNMEASURED: the issue list reached its 1000-issue limit/)
    expect(f.log()).not.toMatch(MUTATION)
  })

  test('a failed issue write exits 3', () => {
    const f = fixture()
    const result = f.run('b.yaml', 'a.yaml', {FAKE_GH_FAIL: 'create'})
    expect(result.status).toBe(3)
    expect(result.stdout).toMatch(/UNMEASURED: GitHub call failed: gh issue create/)
    expect(f.issues()).toEqual([])
  })

  test('a personal-token writer in another repository: MANAGED_AUTHOR keeps exactly one issue', () => {
    const f = fixture()
    const writer = {ISSUE_REPO: 'j0nathan-ll0yd/ios-OfflineMediaDownloader', MANAGED_AUTHOR: 'j0nathan-ll0yd', FAKE_GH_AUTHOR: 'j0nathan-ll0yd'}
    expect(f.run('b.yaml', 'a.yaml', writer).status).toBe(0)
    expect(f.run('b.yaml', 'a.yaml', writer).status).toBe(0)
    expect(managed(f.issues(), 'j0nathan-ll0yd')).toHaveLength(1)
    expect(f.log().match(/issue create/g)).toHaveLength(1)
    expect(f.run('a.yaml', 'a.yaml', writer).status).toBe(0)
    expect(f.issues()[0]?.state).toBe('CLOSED')
  })

  test('a diff over the byte budget is cut at a line end, so the body stays valid UTF-8 and under the limit', () => {
    const f = fixture()
    const padding = Array.from({length: 2000}, (_, index) => `  x-padding-${index}: caf\u00e9 cr\u00e8me br\u00fbl\u00e9e`).join('\n')
    writeFileSync(join(f.dir, 'big.yaml'), `${SPEC_A}${padding}\n`)
    expect(f.run('big.yaml', 'a.yaml').status).toBe(0)
    const body = f.issues()[0]?.body ?? ''
    expect(body).toMatch(/\[diff truncated to its first 50000 bytes of \d+, at a line end\]/)
    expect(body).not.toContain('\uFFFD')
    expect(body).toMatch(/^\+ {2}x-padding-\d+: caf\u00e9 cr\u00e8me br\u00fbl\u00e9e\n\[diff truncated/m)
    expect(body.length).toBeLessThan(65536)
  })

  test('ISSUE_REPO overrides GITHUB_REPOSITORY as the issue target; neither set is unmeasured', () => {
    const f = fixture()
    expect(f.run('b.yaml', 'a.yaml', {ISSUE_REPO: 'j0nathan-ll0yd/ios-OfflineMediaDownloader'}).status).toBe(0)
    expect(f.log()).toMatch(/issue create --repo j0nathan-ll0yd\/ios-OfflineMediaDownloader /)
    expect(f.run('b.yaml', 'a.yaml', {ISSUE_REPO: '', GITHUB_REPOSITORY: ''}).status).toBe(3)
  })

  test('dry run reports the decision and mutates nothing', () => {
    const f = fixture([issue(9, `${MARKER}\nold`, 'CLOSED')])
    const result = f.run('b.yaml', 'a.yaml', {DRY_RUN: 'true'})
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/DRY RUN: gh issue edit 9 /)
    expect(result.stdout).toMatch(/DRY RUN: gh issue reopen 9 /)
    expect(result.stdout).toContain('bash Scripts/sync-openapi.sh')
    expect(f.log()).not.toMatch(MUTATION)
    expect(f.issues()).toEqual([issue(9, `${MARKER}\nold`, 'CLOSED')])
  })
})
