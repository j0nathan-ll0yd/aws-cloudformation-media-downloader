/**
 * Git Sandbox Environment
 *
 * Environment for child processes that run git inside a throwaway test repository.
 *
 * Git exports GIT_DIR and the other repository-local variables to the commands that hooks,
 * `git rebase -x` and `git bisect run` start. If a test inherited them, its `git init` and
 * `git add` would act on the developer's own repository instead of the throwaway one. The
 * variable names come from git itself (`git rev-parse --local-env-vars`), so the list moves
 * with the installed git instead of a hand-kept copy. The user and system git config are
 * dropped too, so settings such as `color.ui` or `core.hooksPath` cannot change a test's outcome.
 *
 * The vitest suites import this file, and so does
 * scripts/__tests__/check-package-versions.spawn.test.mjs, through Node's type stripping.
 */
import {spawnSync} from 'node:child_process'

// Variables that scope git to a repository or a ref namespace, but that git does not list.
const UNLISTED_GIT_VARS = ['GIT_NAMESPACE', 'GIT_CEILING_DIRECTORIES']
// The numbered config pairs that GIT_CONFIG_COUNT turns on; git lists only the count.
const GIT_CONFIG_PAIR = /^GIT_CONFIG_(KEY|VALUE)_\d+$/

let localEnvVars: readonly string[] | undefined

/**
 * The repository-local variable names that `git rev-parse --local-env-vars` prints.
 * Fails closed: a failed call, or an answer without GIT_DIR, throws. An empty list would
 * strip nothing, and every caller would run with the inherited environment.
 * @param env - Environment for the git call; its PATH selects the git binary
 * @returns One name per line of git's output
 */
export function gitLocalEnvVars(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  const result = spawnSync('git', ['rev-parse', '--local-env-vars'], {encoding: 'utf8', env})
  const names = (result.stdout ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (result.error !== undefined || result.status !== 0 || !names.includes('GIT_DIR')) {
    throw new Error(`git rev-parse --local-env-vars did not list GIT_DIR (status ${String(result.status)}): ${result.error?.message ?? result.stderr}`)
  }
  return names
}

/**
 * The current environment without the repository-local git variables and without user or system git config.
 * @param extra - Variables to add or override, for example a PATH with a fake binary first
 * @returns An environment for `spawnSync`, which leaves out every key whose value is undefined
 */
export function isolatedGitEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  localEnvVars ??= gitLocalEnvVars()
  const removed = new Set([...localEnvVars, ...UNLISTED_GIT_VARS])
  const unset = Object.fromEntries(Object.keys(process.env).filter((key) => removed.has(key) || GIT_CONFIG_PAIR.test(key)).map((key) => [key, undefined]))
  return {...process.env, ...unset, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...extra}
}
