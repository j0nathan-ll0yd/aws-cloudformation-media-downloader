/**
 * @fixture invalid
 * @rule env-validation
 * @severity CRITICAL
 * @description Direct process.env access (forbidden)
 * @expectedViolations 1
 */
const region = process.env.AWS_REGION
export const handler = () => region
