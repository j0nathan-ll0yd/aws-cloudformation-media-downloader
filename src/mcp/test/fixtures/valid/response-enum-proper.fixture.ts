/**
 * @fixture valid
 * @rule response-enum
 * @description Using ResponseStatus enum (allowed)
 * @expectedViolations 0
 */
return response(200, {status: ResponseStatus.Success})
