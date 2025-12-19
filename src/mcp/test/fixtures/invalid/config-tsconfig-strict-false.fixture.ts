/**
 * @fixture invalid
 * @rule config-enforcement
 * @severity CRITICAL
 * @description TSConfig with strict mode disabled
 * @expectedViolations 1
 * @simulatedPath tsconfig.json
 */
{"compilerOptions": {"strict": false}}
