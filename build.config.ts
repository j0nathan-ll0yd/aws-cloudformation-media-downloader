import {defineBuildConfig} from 'unbuild'

/**
 * unbuild Configuration
 *
 * Used for library-style builds (barrel export).
 * For Lambda-specific bundling with per-function output, use the esbuild config.
 */
export default defineBuildConfig({
  entries: ['src/index'],
  declaration: false,
  rollup: {emitCJS: false},
  externals: [/^@aws-sdk\//, 'aws-lambda', /^drizzle-orm/]
})
