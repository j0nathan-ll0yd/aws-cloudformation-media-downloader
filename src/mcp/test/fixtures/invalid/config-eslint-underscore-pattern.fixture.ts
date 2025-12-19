/**
 * @fixture invalid
 * @rule config-enforcement
 * @severity CRITICAL
 * @description ESLint config with argsIgnorePattern underscore (forbidden)
 * @expectedViolations 1
 * @simulatedPath eslint.config.mjs
 */
export default [
	{
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}]
		}
	}
]
