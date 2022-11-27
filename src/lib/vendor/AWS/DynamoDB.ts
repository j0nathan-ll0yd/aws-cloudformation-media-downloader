import * as AWS from 'aws-sdk'
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client'
const docClient = new AWS.DynamoDB.DocumentClient()

export function updateItem(params: DocumentClient.UpdateItemInput): Promise<DocumentClient.UpdateItemOutput> {
  return docClient.update(params).promise()
}

export function putItem(params: DocumentClient.PutItemInput): Promise<DocumentClient.PutItemOutput> {
  return docClient.put(params).promise()
}

export function scan(params: DocumentClient.ScanInput): Promise<DocumentClient.ScanOutput> {
  return docClient.scan(params).promise()
}

export function batchGet(params: DocumentClient.BatchGetItemInput): Promise<DocumentClient.BatchGetItemOutput> {
  return docClient.batchGet(params).promise()
}

export function query(params: DocumentClient.QueryInput): Promise<DocumentClient.QueryOutput> {
  return docClient.query(params).promise()
}

export function deleteItem(params: DocumentClient.DeleteItemInput): Promise<DocumentClient.DeleteItemOutput> {
  return docClient.delete(params).promise()
}
