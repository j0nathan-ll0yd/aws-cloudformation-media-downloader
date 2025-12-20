/**
 * @fixture valid
 * @rule env-validation
 * @description Using getRequiredEnv helper (allowed)
 * @expectedViolations 0
 */
import {getRequiredEnv} from '#util/env-validation'
const region = getRequiredEnv('AWS_REGION')
export { region }
