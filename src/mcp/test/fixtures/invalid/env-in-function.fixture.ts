/**
 * @fixture invalid
 * @rule env-validation
 * @severity CRITICAL
 * @description Direct process.env in function body (forbidden)
 * @expectedViolations 1
 */
export function getConfig() {
  return process.env.MY_CONFIG
}
