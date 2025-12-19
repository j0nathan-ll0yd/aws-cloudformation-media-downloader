/**
 * @fixture valid
 * @rule batch-retry
 * @description Using retryUnprocessed wrapper (allowed)
 * @expectedViolations 0
 */
const results = await retryUnprocessed(Users.batchGet(items))
