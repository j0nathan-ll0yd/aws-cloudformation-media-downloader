/**
 * @fixture valid
 * @rule aws-sdk-encapsulation
 * @description Entity imports (allowed)
 * @expectedViolations 0
 */
import {Files} from '#entities/Files'
import {Users} from '#entities/Users'

export async function handler() {
  const user = await Users.get({userId: '123'}).go()
  const files = await Files.query.byUser({userId: '123'}).go()
  return {user, files}
}
