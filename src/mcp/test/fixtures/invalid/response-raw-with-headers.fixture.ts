/**
 * @fixture invalid
 * @rule response-helpers
 * @severity HIGH
 * @description Raw response with headers (forbidden)
 * @expectedViolations 1
 */
export async function handler(event: APIGatewayProxyEvent) {
  return {statusCode: 302, headers: {Location: 'https://example.com'}}
}
