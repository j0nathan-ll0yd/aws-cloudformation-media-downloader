/**
 * @fixture valid
 * @rule env-validation
 * @description Using getRequiredEnvNumber helper (allowed)
 * @expectedViolations 0
 */
import {getRequiredEnvNumber} from '#util/env-validation'
const timeout = getRequiredEnvNumber('TIMEOUT_MS')
export {timeout}
