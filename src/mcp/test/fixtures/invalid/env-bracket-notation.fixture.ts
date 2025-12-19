/**
 * @fixture invalid
 * @rule env-validation
 * @severity CRITICAL
 * @description Bracket notation process.env access (forbidden)
 * @expectedViolations 1
 */
const value = process.env['MY_VAR']
export {value}
