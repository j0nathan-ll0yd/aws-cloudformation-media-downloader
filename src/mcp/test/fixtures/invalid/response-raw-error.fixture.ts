/**
 * @fixture invalid
 * @rule response-helpers
 * @severity HIGH
 * @description Raw error response without helper (forbidden)
 * @expectedViolations 1
 */
export async function handler() {
	try {
		throw new Error('test')
	} catch (e) {
		return {
			statusCode: 500,
			body: JSON.stringify({error: 'Internal error'})
		}
	}
}
