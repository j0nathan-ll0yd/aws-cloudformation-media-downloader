/**
 * @fixture valid
 * @rule cascade-safety
 * @description Promise.all without delete operations (allowed)
 * @expectedViolations 0
 */
await Promise.all([Users.get({userId}).go(), Files.get({fileId}).go()])
