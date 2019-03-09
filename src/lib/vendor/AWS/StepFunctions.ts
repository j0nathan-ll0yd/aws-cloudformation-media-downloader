import {Types} from 'aws-sdk/clients/stepfunctions'

const AWS = require('aws-sdk')
const stepfunctions = new AWS.StepFunctions({apiVersion: '2016-11-23'})

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
