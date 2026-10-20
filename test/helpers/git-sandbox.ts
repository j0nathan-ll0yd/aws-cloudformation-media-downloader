/**
 * Git Sandbox Environment
 *
 * Environment for child processes that run git inside a throwaway test repository.
 *
 * Git exports GIT_DIR and the other location variables to the commands that hooks,
 * `git rebase -x` and `git bisect run` start. If a test inherited them, its `git init` and
 * `git add` would act on the developer's own repository instead of the throwaway one. The
 * user and system git config are dropped too, so settings such as `color.ui` or
 * `core.hooksPath` cannot change a test's outcome.
 */

const GIT_LOCATION_VARS = [
  'GIT_DIR',
  'GIT_COMMON_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_NAMESPACE',
  'GIT_PREFIX',
  'GIT_CEILING_DIRECTORIES'
]

/**
 * The current environment without the git location variables and without user or system git config.
 * @param extra - Variables to add or override, for example a PATH with a fake binary first
 * @returns An environment for `spawnSync`, which leaves out every key whose value is undefined
 */
export function isolatedGitEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const unset = Object.fromEntries(GIT_LOCATION_VARS.map((key) => [key, undefined]))
  return {...process.env, ...unset, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...extra}
}
