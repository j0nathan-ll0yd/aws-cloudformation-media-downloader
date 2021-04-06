import * as AWS from 'aws-sdk'
import {IdentityProviderApple, User, UserDevice} from '../types/main'
const docClient = new AWS.DynamoDB.DocumentClient()

function transformObjectToDynamoUpdateQuery(item: object) {
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
  return {UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues}
}

export function updateCompletedFileParams(tableName, fileId, fileUrl) {
  return {
    ExpressionAttributeNames: { '#FN': 'url' },
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
      '#FN': 'url'
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

export function updateUserDeviceParams(tableName, userId, userDevice: UserDevice) {
  return {
    TableName: tableName,
    Key: { userId },
    UpdateExpression: 'SET #userDevice = list_append(if_not_exists(#userDevice, :empty_list), :userDevice)',
    ExpressionAttributeNames: { '#userDevice' : 'userDevice' },
    ExpressionAttributeValues: { ':userDevice': [userDevice], ':empty_list': [] }
  }
}

export function queryUserDeviceParams(tableName, userId, userDevice: UserDevice) {
  return {
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: 'contains(userDevice, :userDevice)',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':userDevice': userDevice
    }
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
  const {UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues} = transformObjectToDynamoUpdateQuery(item)
  return {
    Key: { 'fileId': item.fileId },
    TableName: tableName,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
  }
}

export function getUserFilesParams(tableName, userId) {
  return {
    ExpressionAttributeValues: {
      ':uid': userId
    },
    ExpressionAttributeNames:{
      '#uid': 'userId'
    },
    KeyConditionExpression: '#uid = :uid',
    TableName: tableName
  }
}

export function getBatchFilesParams(tableName:string, files) {
  const Keys = []
  const mySet = docClient.createSet(files)
  for (const fileId of mySet.values) {
    Keys.push({fileId})
  }

  return {
    RequestItems: {
      [tableName]: { Keys }
    }
  }
}

export function getUserByAppleDeviceIdentifier(tableName:string, userId:string) {
  return {
    ExpressionAttributeValues: { ':userId': userId },
    FilterExpression: 'identityProviders.userId = :userId',
    TableName: tableName
  }
}
