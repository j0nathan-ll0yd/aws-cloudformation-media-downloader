const AWS = require('aws-sdk')
const sns = new AWS.SNS({apiVersion: '2010-03-31'})

export function publishSnsEvent(params) {
  return new Promise((resolve, reject) => {
    sns.publish(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}
