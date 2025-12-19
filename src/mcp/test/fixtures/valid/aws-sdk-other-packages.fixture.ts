/**
 * @fixture valid
 * @rule aws-sdk-encapsulation
 * @description Non-SDK packages like uuid and aws-lambda types (allowed)
 * @expectedViolations 0
 */
import {v4 as uuidv4} from 'uuid'
import {APIGatewayProxyEvent} from 'aws-lambda'

export async function handler(event: APIGatewayProxyEvent) {
	const id = uuidv4()
	return {statusCode: 200, body: JSON.stringify({id, path: event.path})}
}
