/**
 * @fixture invalid
 * @rule batch-retry
 * @severity HIGH
 * @description batchWrite without retry wrapper (forbidden)
 * @expectedViolations 1
 */
await Users.batchWrite(items).go()
