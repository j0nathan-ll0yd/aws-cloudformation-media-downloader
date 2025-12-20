/**
 * @fixture invalid
 * @rule aws-sdk-encapsulation
 * @severity CRITICAL
 * @description Dynamic AWS SDK import (forbidden)
 * @expectedViolations 1
 */
const sdk = await import('@aws-sdk/client-dynamodb')

export { sdk }
