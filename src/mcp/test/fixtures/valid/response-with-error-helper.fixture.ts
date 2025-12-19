/**
 * @fixture valid
 * @rule response-helpers
 * @description Using lambdaErrorResponse helper (allowed)
 * @expectedViolations 0
 */
import {lambdaErrorResponse, response} from '#util/lambda-helpers'

export async function handler() {
	try {
		return response(200, {})
	} catch (error) {
		return lambdaErrorResponse(500, error, 'Failed')
	}
}
