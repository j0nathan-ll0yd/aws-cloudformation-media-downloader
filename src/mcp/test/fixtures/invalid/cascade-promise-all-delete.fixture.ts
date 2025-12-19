/**
 * @fixture invalid
 * @rule cascade-safety
 * @severity CRITICAL
 * @description Promise.all with delete operations (forbidden)
 * @expectedViolations 1
 */
await Promise.all([
	Users.delete({userId}).go(),
	UserFiles.delete({userId}).go()
])
