/**
 * @fixture valid
 * @rule types-location
 * @description Internal (non-exported) types (allowed anywhere)
 * @expectedViolations 0
 * @simulatedPath src/util/helpers.ts
 */
type InternalConfig = {value: string}
interface InternalOptions {
	enabled: boolean
}
enum InternalStatus {
	Active
}
