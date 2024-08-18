import {BatchGetItemInput, DeleteItemInput, DynamoDBClient, PutItemInput, QueryInput, ScanInput, UpdateItemInput} from '@aws-sdk/client-dynamodb'
import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb'
const client = new DynamoDBClient()
const docClient = DynamoDBDocument.from(client)

export function updateItem(params: UpdateItemInput) {
  return docClient.update(params)
}

export function putItem(params: PutItemInput) {
  return docClient.put(params)
}

export function scan(params: ScanInput) {
  return docClient.scan(params)
}

export function batchGet(params: BatchGetItemInput) {
  return docClient.batchGet(params)
}

export function query(params: QueryInput) {
  return docClient.query(params)
}

export function deleteItem(params: DeleteItemInput) {
  return docClient.delete(params)
}
