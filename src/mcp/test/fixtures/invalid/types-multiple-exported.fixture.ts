/**
 * @fixture invalid
 * @rule types-location
 * @severity HIGH
 * @description Multiple exported types in non-types location
 * @expectedViolations 3
 * @simulatedPath src/util/helpers.ts
 */
export type Config = {value: string}
export type Options = {enabled: boolean}
export type Params = {id: number}
