/**
 * @fixture valid
 * @rule response-helpers
 * @description Using buildValidatedResponse() helper (allowed)
 * @expectedViolations 0
 */
import {buildValidatedResponse} from '#lib/lambda/responses'

export async function handler() {
  return buildValidatedResponse(context, 200, {success: true})
}
