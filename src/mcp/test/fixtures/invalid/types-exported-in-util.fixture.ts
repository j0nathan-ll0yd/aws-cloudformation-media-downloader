/**
 * @fixture invalid
 * @rule types-location
 * @severity HIGH
 * @description Exported type alias in util file (should be in src/types/)
 * @expectedViolations 1
 * @simulatedPath src/util/foo-helpers.ts
 */
export type FooConfig = {bar: string}
