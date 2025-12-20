/**
 * @fixture invalid
 * @rule types-location
 * @severity HIGH
 * @description Exported enum in util file (should be in src/types/)
 * @expectedViolations 1
 * @simulatedPath src/util/status.ts
 */
export enum Status {
  Pending = 'pending',
  Active = 'active'
}
