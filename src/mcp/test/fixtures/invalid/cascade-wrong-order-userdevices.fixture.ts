/**
 * @fixture invalid
 * @rule cascade-safety
 * @severity CRITICAL
 * @description Incorrect cascade order - Users deleted before UserDevices
 * @expectedViolations 1
 */
await Users.delete({userId}).go()
await UserDevices.delete({userId}).go()
