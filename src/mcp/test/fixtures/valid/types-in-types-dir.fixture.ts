/**
 * @fixture valid
 * @rule types-location
 * @description Types in src/types/ directory (allowed)
 * @expectedViolations 0
 * @simulatedPath src/types/main.ts
 */
export type Config = {value: string}
export interface Options {
  enabled: boolean
}
export enum Status {
  Active
}
