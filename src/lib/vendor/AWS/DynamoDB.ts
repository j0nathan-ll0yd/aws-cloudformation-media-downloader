import * as AWS from 'aws-sdk'
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client'
const docClient = new AWS.DynamoDB.DocumentClient()

export function updateItem(params: DocumentClient.UpdateItemInput): Promise<DocumentClient.UpdateItemOutput> {
  return new Promise((resolve, reject) => {
    docClient.update(params, (error, multipart) => {
      if (error) {
        return reject(error)
      }
      return resolve(multipart)
    })
  })
}

export function putItem(params: DocumentClient.PutItemInput): Promise<DocumentClient.PutItemOutput> {
  return new Promise((resolve, reject) => {
    docClient.put(params, (error, multipart) => {
      if (error) {
        return reject(error)
      }
      return resolve(multipart)
    })
  })
}

export function scan(params: DocumentClient.ScanInput): Promise<DocumentClient.ScanOutput> {
  return new Promise((resolve, reject) => {
    docClient.scan(params, (error, multipart) => {
      if (error) {
        return reject(error)
      }
      return resolve(multipart)
    })
  })
}
