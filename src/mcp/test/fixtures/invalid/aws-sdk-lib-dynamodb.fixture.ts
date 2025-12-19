/**
 * @fixture invalid
 * @rule aws-sdk-encapsulation
 * @severity CRITICAL
 * @description Direct lib-dynamodb import (forbidden)
 * @expectedViolations 1
 */
import {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb'

export {DynamoDBDocumentClient}
