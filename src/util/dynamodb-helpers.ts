import * as AWS from 'aws-sdk'
import {IdentityProviderApple, User} from '../types/main'
const docClient = new AWS.DynamoDB.DocumentClient()

export function updateCompletedFileParams(tableName, fileId, fileUrl) {
  return {
    ExpressionAttributeNames: { '#FN': 'fileUrl' },
    ExpressionAttributeValues: { ':fn': fileUrl },
    Key: { 'fileId': fileId },
    ReturnValues: 'ALL_NEW',
    TableName: tableName,
    UpdateExpression: 'SET #FN = :fn'
  }
}

export function scanForFileParams(tableName) {
  return {
    ExpressionAttributeNames: {
      '#AA': 'availableAt',
      '#FID': 'fileId',
      '#FN': 'fileUrl'
    },
    ExpressionAttributeValues: {
      ':aa': Date.now().toString()
    },
    FilterExpression: '#AA <= :aa AND attribute_not_exists(#FN)',
    ProjectionExpression: '#AA, #FID',
    TableName: tableName
  }
}

export function userFileParams(tableName, userId, fileId) {
  return {
    ExpressionAttributeNames: { '#FID': 'fileId' },
    ExpressionAttributeValues: { ':fid': docClient.createSet([fileId]) },
    Key: { 'userId': userId },
    ReturnValues: 'NONE',
    UpdateExpression: 'ADD #FID :fid',
    TableName: tableName
  }
}

export function newFileParams(tableName, fileId) {
  return {
    ExpressionAttributeNames: { '#AA': 'availableAt' },
    ExpressionAttributeValues: { ':aa': Date.now().toString() },
    Key: { 'fileId': fileId },
    ReturnValues: 'ALL_OLD',
    UpdateExpression: 'SET #AA = if_not_exists(#AA, :aa)',
    TableName: tableName
  }
}

export function newUserParams(tableName, user: User, identityProviderApple: IdentityProviderApple) {
  return {
    Item: {
      ...user,
      identityProviders: { ...identityProviderApple }
    },
    TableName: tableName
  }
}

export function updateFileMetadataParams(tableName, item) {
  let UpdateExpression = 'SET'
  const ExpressionAttributeNames = {}
  const ExpressionAttributeValues = {}
  for (const property in item) {
    if (property === 'fileId') { continue }
    if (item.hasOwnProperty(property)) {
      UpdateExpression += ` #${property} = :${property} ,`
      ExpressionAttributeNames['#' + property] = property
      ExpressionAttributeValues[':' + property] = item[property]
    }
  }
  UpdateExpression = UpdateExpression.slice(0, -1)
  return {
    Key: { 'fileId': item.fileId },
    TableName: tableName,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
  }
}
