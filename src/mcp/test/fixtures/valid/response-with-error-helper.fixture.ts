/**
 * @fixture valid
 * @rule response-helpers
 * @description Using buildApiResponse helper for errors (allowed)
 * @expectedViolations 0
 */
import {buildApiResponse} from '#util/lambda-helpers'

export async function handler() {
  try {
    return buildApiResponse(200, {})
  } catch (error) {
    return buildApiResponse(500, error as Error)
  }
}
