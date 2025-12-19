/**
 * @fixture valid
 * @rule authenticated-handler-enforcement
 * @description Using wrapOptionalAuthHandler (allowed)
 * @expectedViolations 0
 */
import {wrapOptionalAuthHandler} from '#util/lambda-helpers'
import type {OptionalAuthApiParams} from '#types/lambda-wrappers'
import {UserStatus} from '#types/enums'

export const handler = wrapOptionalAuthHandler(async ({context, userId, userStatus}: OptionalAuthApiParams) => {
	if (userStatus === UserStatus.Anonymous) {
		return response(context, 200, {demo: true})
	}
	return response(context, 200, {userId})
})
