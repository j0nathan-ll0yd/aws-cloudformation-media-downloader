/**
 * @fixture invalid
 * @rule response-helpers
 * @severity HIGH
 * @description Promise.resolve with raw response (forbidden)
 * @expectedViolations 1
 */
export async function handler() {
	return Promise.resolve({
		statusCode: 200,
		body: JSON.stringify({})
	})
}
