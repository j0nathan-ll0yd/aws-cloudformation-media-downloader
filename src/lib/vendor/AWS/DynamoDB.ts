import {DynamoDBClient} from '@aws-sdk/client-dynamodb'
import {
  BatchGetCommandInput,
  DeleteCommandInput,
  DynamoDBDocument,
  PutCommandInput,
  QueryCommandInput,
  ScanCommandInput,
  UpdateCommandInput
} from '@aws-sdk/lib-dynamodb'

// Re-export types for application code to use
export type {
  BatchGetCommandInput,
  DeleteCommandInput,
  PutCommandInput,
  QueryCommandInput,
  ScanCommandInput,
  UpdateCommandInput
}

const client = new DynamoDBClient()
const docClient = DynamoDBDocument.from(client)

export function updateItem(params: UpdateCommandInput) {
  return docClient.update(params)
}

export function putItem(params: PutCommandInput) {
  return docClient.put(params)
}

export function scan(params: ScanCommandInput) {
  return docClient.scan(params)
}

export function batchGet(params: BatchGetCommandInput) {
  return docClient.batchGet(params)
}

export function query(params: QueryCommandInput) {
  return docClient.query(params)
}

export function deleteItem(params: DeleteCommandInput) {
  return docClient.delete(params)
}
