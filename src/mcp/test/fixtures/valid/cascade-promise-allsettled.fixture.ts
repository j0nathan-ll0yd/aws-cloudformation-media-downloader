/**
 * @fixture valid
 * @rule cascade-safety
 * @description Promise.allSettled with deletes (allowed)
 * @expectedViolations 0
 */
await Promise.allSettled([
	Users.delete({userId}).go(),
	UserFiles.delete({userId}).go()
])
