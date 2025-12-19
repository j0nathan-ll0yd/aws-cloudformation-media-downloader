/**
 * @fixture invalid
 * @rule authenticated-handler-enforcement
 * @severity HIGH
 * @description Manual auth handling with getUserDetailsFromEvent (forbidden)
 * @expectedViolations 1
 */
import {getUserDetailsFromEvent} from '#util/apigateway-helpers'
import {wrapApiHandler} from '#util/lambda-helpers'

export const handler = wrapApiHandler(async ({event, context}) => {
	const {userId, userStatus} = getUserDetailsFromEvent(event)
	if (!userId) {
		throw new Error('Unauthorized')
	}
	return response(context, 200, {})
})
