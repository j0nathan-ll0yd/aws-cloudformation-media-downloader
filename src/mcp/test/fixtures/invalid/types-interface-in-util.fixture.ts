/**
 * @fixture invalid
 * @rule types-location
 * @severity HIGH
 * @description Exported interface in util file (should be in src/types/)
 * @expectedViolations 1
 * @simulatedPath src/util/bar-helpers.ts
 */
export interface BarResult {
  success: boolean
}
