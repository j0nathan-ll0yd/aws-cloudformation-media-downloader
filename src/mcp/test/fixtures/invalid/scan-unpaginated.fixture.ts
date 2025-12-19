/**
 * @fixture invalid
 * @rule scan-pagination
 * @severity HIGH
 * @description Unpaginated scan operation
 * @expectedViolations 1
 */
const scanOp = Users.scan
const items = await scanOp.go()
