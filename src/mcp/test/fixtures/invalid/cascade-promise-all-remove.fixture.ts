/**
 * @fixture invalid
 * @rule cascade-safety
 * @severity CRITICAL
 * @description Promise.all with remove operations (forbidden)
 * @expectedViolations 1
 */
await Promise.all([entity.remove({id}).go()])
