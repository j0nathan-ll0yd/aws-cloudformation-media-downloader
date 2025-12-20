/**
 * @fixture invalid
 * @rule config-enforcement
 * @severity HIGH
 * @description ESLint config with unauthorized ignores
 * @expectedViolations 1
 * @simulatedPath eslint.config.mjs
 */
export default [
  {ignores: ['**/node_modules', '**/secret-backdoor']}
]
