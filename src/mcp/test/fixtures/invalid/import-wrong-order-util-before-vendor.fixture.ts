/**
 * @fixture invalid
 * @rule import-order
 * @severity MEDIUM
 * @description Utilities imported before vendor (wrong order)
 * @expectedViolations 1
 */
import {response} from '#util/lambda-helpers'
import {queryItems} from '#lib/vendor/AWS/DynamoDB'
