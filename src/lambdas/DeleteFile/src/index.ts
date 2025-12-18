import {APIGatewayProxyResult} from 'aws-lambda'
import {Files} from '#entities/Files'
import {UserFiles} from '#entities/UserFiles'
import type {ApiHandlerParams} from '#types/lambda-wrappers'
import {generateUnauthorizedError, getUserDetailsFromEvent, logDebug, logError, response, wrapApiHandler} from '#util/lambda-helpers'
import {UserStatus} from '#types/enums'
import {withXRay} from '#lib/vendor/AWS/XRay'
import {deleteObject} from '#lib/vendor/AWS/S3'
import {getRequiredEnv} from '#util/env-validation'

/**
 * Deletes a file for a user.
 *
 * Workflow:
 * 1. Remove the UserFiles association between the user and the file
 * 2. Check if any other users still reference this file
 * 3. If no other users reference the file, delete it from S3 and remove the Files record
 * 4. If other users still reference it, only remove the UserFiles record (keep the file)
 *
 * @param event - API Gateway event with fileId in path parameters
 * @param context - Lambda context
 * @returns 204 No Content on success, 404 if file not found, 401 if unauthorized
 * @notExported
 */
export const handler = withXRay(wrapApiHandler(async ({event, context}: ApiHandlerParams): Promise<APIGatewayProxyResult> => {
  const {userId, userStatus} = getUserDetailsFromEvent(event)

  if (userStatus === UserStatus.Unauthenticated) {
    throw generateUnauthorizedError()
  }

  if (userStatus === UserStatus.Anonymous) {
    throw generateUnauthorizedError()
  }

  // Extract fileId from path parameters
  const fileId = event.pathParameters?.fileId
  if (!fileId) {
    return response(context, 400, 'fileId is required')
  }

  logDebug('DeleteFile <=', {userId, fileId})

  // Check if the UserFiles association exists
  const userFileKey = {userId: userId as string, fileId}
  const userFileResponse = await UserFiles.get(userFileKey).go()
  logDebug('DeleteFile.userFile =>', userFileResponse)

  if (!userFileResponse || !userFileResponse.data) {
    return response(context, 404, 'File not found for this user')
  }

  // Delete the UserFiles association
  await UserFiles.delete(userFileKey).go()
  logDebug('DeleteFile.userFileDeleted', userFileKey)

  // Check if any other users still reference this file
  const otherUsersResponse = await UserFiles.query.byFile({fileId}).go()
  logDebug('DeleteFile.otherUsers =>', otherUsersResponse)

  const hasOtherUsers = otherUsersResponse.data && otherUsersResponse.data.length > 0

  if (!hasOtherUsers) {
    // No other users reference this file, so delete it from S3 and DynamoDB
    logDebug('DeleteFile.noOtherUsers', 'Deleting file from S3 and DynamoDB')

    // Get the file record to obtain the S3 key
    const fileResponse = await Files.get({fileId}).go()
    logDebug('DeleteFile.file =>', fileResponse)

    if (fileResponse && fileResponse.data) {
      const file = fileResponse.data
      const bucket = getRequiredEnv('S3BucketName')

      // Delete from S3
      try {
        await deleteObject(bucket, file.key)
        logDebug('DeleteFile.s3Deleted', file.key)
      } catch (error) {
        logError('DeleteFile: Failed to delete from S3', error)
        // Continue with DynamoDB deletion even if S3 deletion fails
      }

      // Delete from DynamoDB
      await Files.delete({fileId}).go()
      logDebug('DeleteFile.fileDeleted', fileId)
    }
  } else {
    logDebug('DeleteFile.hasOtherUsers', `${otherUsersResponse.data.length} other users still reference this file`)
  }

  return response(context, 204)
}))
