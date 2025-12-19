/**
 * @fixture valid
 * @rule scan-pagination
 * @description Using scanAllPages wrapper (allowed)
 * @expectedViolations 0
 */
const items = await scanAllPages(Users.scan)
