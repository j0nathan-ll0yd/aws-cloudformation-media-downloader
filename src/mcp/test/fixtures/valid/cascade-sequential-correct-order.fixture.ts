/**
 * @fixture valid
 * @rule cascade-safety
 * @description Sequential deletes in correct order - children first (allowed)
 * @expectedViolations 0
 */
await UserFiles.delete({userId}).go()
await UserDevices.delete({userId}).go()
await Users.delete({userId}).go()
