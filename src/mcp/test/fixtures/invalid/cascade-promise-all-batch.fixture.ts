/**
 * @fixture invalid
 * @rule cascade-safety
 * @severity CRITICAL
 * @description Promise.all with batchWrite operations (forbidden)
 * @expectedViolations 1
 */
await Promise.all([batchWrite(deleteOps)])
