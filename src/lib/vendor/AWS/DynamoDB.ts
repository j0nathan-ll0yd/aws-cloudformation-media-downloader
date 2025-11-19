import {DynamoDBClient} from '@aws-sdk/client-dynamodb'
import {BatchGetCommandInput, DeleteCommandInput, DynamoDBDocument, PutCommandInput, QueryCommandInput, ScanCommandInput, UpdateCommandInput} from '@aws-sdk/lib-dynamodb'
import AWSXRay from 'aws-xray-sdk-core'

// Re-export types for application code to use
export type {BatchGetCommandInput, DeleteCommandInput, PutCommandInput, QueryCommandInput, ScanCommandInput, UpdateCommandInput}

const enableXRay = process.env.ENABLE_XRAY !== 'false'
const baseClient = new DynamoDBClient()
const client = enableXRay ? AWSXRay.captureAWSv3Client(baseClient) : baseClient
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
