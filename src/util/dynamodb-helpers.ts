import * as AWS from 'aws-sdk'
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client'
import {DynamoDBFile, IdentityProviderApple, User, UserDevice} from '../types/main'
const docClient = new AWS.DynamoDB.DocumentClient()

function transformObjectToDynamoUpdateQuery(item: DynamoDBFile) {
  let UpdateExpression = 'SET'
  const ExpressionAttributeNames = {}
  const ExpressionAttributeValues = {}
  for (const property in item) {
    if (property === 'fileId') {
      continue
    }
    if (Object.prototype.hasOwnProperty.call(item, property)) {
      UpdateExpression += ` #${property} = :${property} ,`
      ExpressionAttributeNames['#' + property] = property
      ExpressionAttributeValues[':' + property] = item[property]
    }
  }
  UpdateExpression = UpdateExpression.slice(0, -1)
  return {
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
  }
}

export function updateCompletedFileParams(tableName: string, fileId: string, fileUrl: string): DocumentClient.UpdateItemInput {
  return {
    ExpressionAttributeNames: {'#FN': 'url'},
    ExpressionAttributeValues: {':fn': fileUrl},
    Key: {fileId: fileId},
    ReturnValues: 'ALL_NEW',
    TableName: tableName,
    UpdateExpression: 'SET #FN = :fn'
  }
}

export function scanForFileParams(tableName: string): DocumentClient.ScanInput {
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

export function getFileByKey(tableName: string, fileName: string): DocumentClient.ScanInput {
  return {
    ExpressionAttributeNames: {'#key': 'key'},
    ExpressionAttributeValues: {':key': fileName},
    FilterExpression: '#key = :key',
    TableName: tableName
  }
}

export function getUsersByFileId(tableName: string, fileId: string): DocumentClient.ScanInput {
  return {
    ExpressionAttributeValues: {':fileId': fileId},
    FilterExpression: 'contains (fileId, :fileId)',
    TableName: tableName
  }
}

export function userFileParams(tableName: string, userId: string, fileId: string): DocumentClient.UpdateItemInput {
  return {
    ExpressionAttributeNames: {'#FID': 'fileId'},
    ExpressionAttributeValues: {':fid': docClient.createSet([fileId])},
    Key: {userId: userId},
    ReturnValues: 'NONE',
    UpdateExpression: 'ADD #FID :fid',
    TableName: tableName
  }
}

export function updateUserDeviceParams(tableName: string, userId: string, userDevice: UserDevice): DocumentClient.UpdateItemInput {
  return {
    TableName: tableName,
    Key: {userId},
    UpdateExpression: 'SET #userDevice = list_append(if_not_exists(#userDevice, :empty_list), :userDevice)',
    ExpressionAttributeNames: {'#userDevice': 'userDevice'},
    ExpressionAttributeValues: {
      ':userDevice': [userDevice],
      ':empty_list': []
    }
  }
}

export function queryUserDeviceParams(tableName: string, userId: string, userDevice: UserDevice): DocumentClient.QueryInput {
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

export function queryFileParams(tableName: string, fileId: string): DocumentClient.QueryInput {
  return {
    TableName: tableName,
    KeyConditionExpression: 'fileId = :fileId',
    ExpressionAttributeValues: {':fileId': fileId}
  }
}

export function getUserDeviceByUserIdParams(tableName: string, userId: string): DocumentClient.QueryInput {
  return {
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {':userId': userId}
  }
}

export function newFileParams(tableName: string, fileId: string): DocumentClient.UpdateItemInput {
  return {
    ExpressionAttributeNames: {'#AA': 'availableAt'},
    ExpressionAttributeValues: {':aa': Date.now().toString()},
    Key: {fileId: fileId},
    ReturnValues: 'ALL_OLD',
    UpdateExpression: 'SET #AA = if_not_exists(#AA, :aa)',
    TableName: tableName
  }
}

export function newUserParams(tableName: string, user: User, identityProviderApple: IdentityProviderApple): DocumentClient.PutItemInput {
  return {
    Item: {
      ...user,
      identityProviders: {...identityProviderApple}
    },
    TableName: tableName
  }
}

export function updateFileMetadataParams(tableName: string, item: DynamoDBFile): DocumentClient.UpdateItemInput {
  const {UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues} = transformObjectToDynamoUpdateQuery(item)
  return {
    Key: {fileId: item.fileId},
    TableName: tableName,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
  }
}

export function getUserFilesParams(tableName: string, userId: string): DocumentClient.QueryInput {
  return {
    ExpressionAttributeValues: {
      ':uid': userId
    },
    ExpressionAttributeNames: {
      '#uid': 'userId'
    },
    KeyConditionExpression: '#uid = :uid',
    TableName: tableName
  }
}

export function getBatchFilesParams(tableName: string, files: string[]): DocumentClient.BatchGetItemInput {
  const Keys = []
  const mySet = docClient.createSet(files)
  for (const fileId of mySet.values) {
    Keys.push({fileId})
  }

  return {
    RequestItems: {
      [tableName]: {Keys}
    }
  }
}

export function getUserByAppleDeviceIdentifierParams(tableName: string, userId: string): DocumentClient.ScanInput {
  return {
    ExpressionAttributeValues: {':userId': userId},
    FilterExpression: 'identityProviders.userId = :userId',
    TableName: tableName
  }
}
