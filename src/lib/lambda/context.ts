import {getOptionalEnv} from '#lib/system/env'
import {logDebug} from '#lib/system/logging'
import {ServiceUnavailableError} from '#lib/system/errors'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import type {UserEventDetails} from '#types/util'
import {UserStatus} from '#types/enums'

/*#__PURE__*/
/** Verifies required APNS platform configuration is present. */
export function verifyPlatformConfiguration(): void {
  const platformApplicationArn = getOptionalEnv('PLATFORM_APPLICATION_ARN', '')
  logDebug('process.env.PLATFORM_APPLICATION_ARN <=', platformApplicationArn)
  if (!platformApplicationArn) {
    throw new ServiceUnavailableError('requires configuration')
  }
}

/** Extracts user identity and status from API Gateway request context. */
export function getUserDetailsFromEvent(event: CustomAPIGatewayRequestAuthorizerEvent): UserEventDetails {
  let principalId = 'unknown'
  // This should always be present, via the API Gateway
  /* c8 ignore else */
  if (event.requestContext.authorizer && event.requestContext.authorizer.principalId) {
    principalId = event.requestContext.authorizer.principalId
  }
  const userId = principalId === 'unknown' ? undefined : principalId
  const authHeader = event.headers['Authorization']
  let userStatus: UserStatus
  if (authHeader && userId) {
    userStatus = UserStatus.Authenticated
  } else if (authHeader) {
    userStatus = UserStatus.Unauthenticated
  } else {
    userStatus = UserStatus.Anonymous
  }
  logDebug('getUserDetailsFromEvent.userId', userId)
  logDebug('getUserDetailsFromEvent.userId.typeof', typeof userId)
  logDebug('getUserDetailsFromEvent.authHeader', authHeader)
  logDebug('getUserDetailsFromEvent.userStatus', userStatus.toString())
  return {userId, userStatus} as UserEventDetails
}
