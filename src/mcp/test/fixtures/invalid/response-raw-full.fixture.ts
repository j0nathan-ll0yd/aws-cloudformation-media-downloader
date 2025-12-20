/**
 * @fixture invalid
 * @rule response-helpers
 * @severity HIGH
 * @description Raw response with all properties (forbidden)
 * @expectedViolations 1
 */
export async function handler() {
  return {statusCode: 200, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({data: []})}
}
