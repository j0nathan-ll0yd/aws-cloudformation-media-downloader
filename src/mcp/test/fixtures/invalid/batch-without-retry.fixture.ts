/**
 * @fixture invalid
 * @rule batch-retry
 * @severity HIGH
 * @description batchGet without retry wrapper (forbidden)
 * @expectedViolations 1
 */
const results = await Users.batchGet(items).go()
