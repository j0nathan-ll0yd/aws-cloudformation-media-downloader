import {SQSEvent} from 'aws-lambda'
import {logDebug} from '../../../util/lambda-helpers'

export async function index(event: SQSEvent) {
  logDebug('event', event)
}
