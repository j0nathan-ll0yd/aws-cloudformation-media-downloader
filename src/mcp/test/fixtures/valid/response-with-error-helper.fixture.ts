/**
 * @fixture valid
 * @rule response-helpers
 * @description Using buildErrorResponse helper for errors (allowed)
 * @expectedViolations 0
 */
import {buildErrorResponse} from '#lib/lambda/responses'

export async function handler() {
  try {
    return buildValidatedResponse(context, 200, {})
  } catch (error) {
    return buildErrorResponse(context, error as Error)
  }
}
