/**
 * @fixture invalid
 * @rule cascade-safety
 * @severity CRITICAL
 * @description Incorrect cascade order - Users deleted before UserFiles
 * @expectedViolations 1
 */
await Users.delete({userId}).go()
await UserFiles.delete({userId}).go()
