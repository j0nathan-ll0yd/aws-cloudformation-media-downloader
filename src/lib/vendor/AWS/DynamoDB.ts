import * as AWS from 'aws-sdk'
import {ScanInput, ScanOutput, UpdateItemInput, UpdateItemOutput} from 'aws-sdk/clients/dynamodb'
const dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'})

export function updateItem(params: UpdateItemInput): Promise<UpdateItemOutput> {
  return new Promise((resolve, reject) => {
    dynamodb.updateItem(params, (error, multipart) => {
      if (error) {
        return reject(error)
      }
      return resolve(multipart)
    })
  })
}

export function scan(params: ScanInput): Promise<ScanOutput> {
  return new Promise((resolve, reject) => {
    dynamodb.scan(params, (error, multipart) => {
      if (error) {
        return reject(error)
      }
      return resolve(multipart)
    })
  })
}
