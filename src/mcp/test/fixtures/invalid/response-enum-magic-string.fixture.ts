/**
 * @fixture invalid
 * @rule response-enum
 * @severity MEDIUM
 * @description Magic string for status (should use ResponseStatus enum)
 * @expectedViolations 1
 */
return response(200, {status: 'success', data: result})
