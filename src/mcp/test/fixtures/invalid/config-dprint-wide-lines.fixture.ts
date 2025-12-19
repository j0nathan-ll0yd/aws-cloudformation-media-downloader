/**
 * @fixture invalid
 * @rule config-enforcement
 * @severity MEDIUM
 * @description dprint config with excessive line width
 * @expectedViolations 1
 * @simulatedPath dprint.json
 */
{"lineWidth": 300}
