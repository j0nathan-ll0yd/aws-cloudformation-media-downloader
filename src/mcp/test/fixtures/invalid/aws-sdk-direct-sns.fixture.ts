/**
 * @fixture invalid
 * @rule aws-sdk-encapsulation
 * @severity CRITICAL
 * @description Direct SNS SDK import (forbidden)
 * @expectedViolations 1
 */
import {SNSClient} from '@aws-sdk/client-sns'

const client = new SNSClient({})
export { client }
