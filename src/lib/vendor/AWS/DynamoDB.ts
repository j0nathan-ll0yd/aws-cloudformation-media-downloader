import {BatchGetCommandInput, DeleteCommandInput, DynamoDBDocument, PutCommandInput, QueryCommandInput, ScanCommandInput, UpdateCommandInput} from '@aws-sdk/lib-dynamodb'
import {createDynamoDBClient} from './clients'

// Re-export types for application code to use
export type {BatchGetCommandInput, DeleteCommandInput, PutCommandInput, QueryCommandInput, ScanCommandInput, UpdateCommandInput}

const client = createDynamoDBClient()
const docClient = DynamoDBDocument.from(client)

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function updateItem(params: UpdateCommandInput) {
  return docClient.update(params)
}
/* c8 ignore stop */

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function putItem(params: PutCommandInput) {
  return docClient.put(params)
}
/* c8 ignore stop */

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function scan(params: ScanCommandInput) {
  return docClient.scan(params)
}
/* c8 ignore stop */

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function batchGet(params: BatchGetCommandInput) {
  return docClient.batchGet(params)
}
/* c8 ignore stop */

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function query(params: QueryCommandInput) {
  return docClient.query(params)
}
/* c8 ignore stop */

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function deleteItem(params: DeleteCommandInput) {
  return docClient.delete(params)
}
/* c8 ignore stop */
