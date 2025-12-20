/**
 * @fixture invalid
 * @rule response-helpers
 * @severity HIGH
 * @description Multiple raw response returns (forbidden)
 * @expectedViolations 3
 */
export async function handler(event) {
  if (!event.body) {
    return {statusCode: 400, body: 'Missing body'}
  }

  try {
    return {statusCode: 200, body: JSON.stringify({})}
  } catch (e) {
    return {statusCode: 500, body: 'Error'}
  }
}
