/**
 * @fixture valid
 * @rule config-enforcement
 * @description Valid ESLint config without underscore patterns
 * @expectedViolations 0
 * @simulatedPath eslint.config.mjs
 */
export default [
  {rules: {quotes: [2, 'single'], semi: [2, 'never']}}
]
