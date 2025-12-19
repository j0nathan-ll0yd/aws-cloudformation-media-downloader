/**
 * @fixture valid
 * @rule authenticated-handler-enforcement
 * @description Using wrapAuthenticatedHandler (allowed)
 * @expectedViolations 0
 */
import {wrapAuthenticatedHandler} from '#util/lambda-helpers'
import type {AuthenticatedApiParams} from '#types/lambda-wrappers'

export const handler = wrapAuthenticatedHandler(async ({context, userId}: AuthenticatedApiParams) => {
	// userId is guaranteed to be a string
	await deleteUser(userId)
	return response(context, 204)
})
