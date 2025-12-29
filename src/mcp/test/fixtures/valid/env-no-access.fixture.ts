/**
 * @fixture valid
 * @rule env-validation
 * @description Code without process.env access (allowed)
 * @expectedViolations 0
 */
import {getUser} from '#entities/queries'
export const handler = async () => {
  return await getUser('123')
}
