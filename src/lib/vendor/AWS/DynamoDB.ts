import {DynamoDBClient, DeleteItemInput, DeleteItemOutput, QueryInput, QueryOutput, UpdateItemInput, UpdateItemOutput, PutItemInput, PutItemOutput, ScanInput, ScanOutput, BatchGetItemInput, BatchGetItemOutput} from '@aws-sdk/client-dynamodb'
import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb'
const client = new DynamoDBClient()
const docClient = DynamoDBDocument.from(client)

export function updateItem(params: UpdateItemInput): Promise<UpdateItemOutput> {
  return docClient.update(params)
}

export function putItem(params: PutItemInput): Promise<PutItemOutput> {
  return docClient.put(params)
}

export function scan(params: ScanInput): Promise<ScanOutput> {
  return docClient.scan(params)
}

export function batchGet(params: BatchGetItemInput): Promise<BatchGetItemOutput> {
  return docClient.batchGet(params)
}

export function query(params: QueryInput): Promise<QueryOutput> {
  return docClient.query(params)
}

export function deleteItem(params: DeleteItemInput): Promise<DeleteItemOutput> {
  return docClient.delete(params)
}
