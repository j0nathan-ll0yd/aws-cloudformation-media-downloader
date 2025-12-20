/**
 * @fixture valid
 * @rule env-validation
 * @description Code without process.env access (allowed)
 * @expectedViolations 0
 */
import {Users} from '#entities/Users'
export const handler = async () => {
  return await Users.get({userId: '123'}).go()
}
