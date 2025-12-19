/**
 * @fixture invalid
 * @rule response-helpers
 * @severity HIGH
 * @description Raw response object with statusCode and body (forbidden)
 * @expectedViolations 1
 */
export async function handler(event: APIGatewayProxyEvent) {
	return {
		statusCode: 200,
		body: JSON.stringify({success: true})
	}
}
