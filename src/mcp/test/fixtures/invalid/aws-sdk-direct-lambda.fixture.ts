/**
 * @fixture invalid
 * @rule aws-sdk-encapsulation
 * @severity CRITICAL
 * @description Direct Lambda SDK import (forbidden)
 * @expectedViolations 1
 */
import {LambdaClient} from '@aws-sdk/client-lambda'

const client = new LambdaClient({})
export { client }
