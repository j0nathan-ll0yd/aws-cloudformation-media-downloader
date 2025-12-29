/**
 * @fixture valid
 * @rule aws-sdk-encapsulation
 * @description Entity query imports (allowed)
 * @expectedViolations 0
 */
import {getUser, getFilesForUser} from '#entities/queries'

export async function handler() {
  const user = await getUser('123')
  const files = await getFilesForUser('123')
  return {user, files}
}
