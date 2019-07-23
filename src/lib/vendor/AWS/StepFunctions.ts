import {Types} from 'aws-sdk/clients/stepfunctions'

import * as AWS from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'
const stepfunctions = AWSXRay.captureAWSClient(new AWS.StepFunctions({apiVersion: '2016-11-23'}))

export function startExecution(params: Types.StartExecutionInput) {
  return new Promise((resolve, reject) => {
    stepfunctions.startExecution(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}
