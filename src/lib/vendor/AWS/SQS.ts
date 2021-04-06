import * as AWS from 'aws-sdk'
import {SendMessageRequest, SendMessageResult} from 'aws-sdk/clients/sqs'
import * as AWSXRay from 'aws-xray-sdk'
const sqs = AWSXRay.captureAWSClient(new AWS.SQS({apiVersion: '2010-03-31'}))

export function sendMessage(params: SendMessageRequest): Promise<SendMessageResult> {
  return new Promise((resolve, reject) => {
    sqs.sendMessage(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}
