/**
 * @fixture invalid
 * @rule import-order
 * @severity MEDIUM
 * @description Utilities imported before vendor (wrong order)
 * @expectedViolations 1
 */
import {buildValidatedResponse} from '#lib/lambda/responses'
import {queryItems} from '#lib/vendor/AWS/DynamoDB'
