/**
 * @fixture valid
 * @rule response-helpers
 * @description Using buildApiResponse() helper (allowed)
 * @expectedViolations 0
 */
import {buildApiResponse} from '#util/lambda-helpers'

export async function handler() {
	return buildApiResponse(200, {success: true})
}
