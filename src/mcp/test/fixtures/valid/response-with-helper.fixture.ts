/**
 * @fixture valid
 * @rule response-helpers
 * @description Using response() helper (allowed)
 * @expectedViolations 0
 */
import {response} from '#util/lambda-helpers'

export async function handler() {
	return response(200, {success: true})
}
