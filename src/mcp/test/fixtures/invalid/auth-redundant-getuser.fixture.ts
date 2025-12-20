/**
 * @fixture invalid
 * @rule authenticated-handler-enforcement
 * @severity HIGH
 * @description Redundant getUserDetailsFromEvent with new wrapper (forbidden)
 * @expectedViolations 1
 */
import {getUserDetailsFromEvent} from '#util/apigateway-helpers'
import {wrapAuthenticatedHandler} from '#util/lambda-helpers'

export const handler = wrapAuthenticatedHandler(async ({event, context, userId}) => {
  // This is redundant - userId is already in params
  const {userId: uid} = getUserDetailsFromEvent(event)
  return response(context, 200, {userId: uid})
})
