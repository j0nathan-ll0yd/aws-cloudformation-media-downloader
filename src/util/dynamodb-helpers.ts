import * as AWS from 'aws-sdk'
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client'
import {DynamoDBFile, IdentityProviderApple, User, Device} from '../types/main'
const docClient = new AWS.DynamoDB.DocumentClient()

function transformObjectToDynamoUpdateQuery(item: object) {
  let UpdateExpression = 'SET'
  const ExpressionAttributeNames: Record<string, string> = {}
  const ExpressionAttributeValues: Record<string, number | string> = {}
  for (const property in item) {
    if (property === 'fileId') {
      continue
    }
    if (Object.prototype.hasOwnProperty.call(item, property)) {
      UpdateExpression += ` #${property} = :${property} ,`
      ExpressionAttributeNames['#' + property] = property
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
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
      ':aa': parseInt(Date.now().toString(), 10)
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

export function userDevicesParams(tableName: string, userId: string, deviceId: string): DocumentClient.UpdateItemInput {
  return {
    ExpressionAttributeNames: {'#DID': 'devices'},
    ExpressionAttributeValues: {':did': docClient.createSet([deviceId])},
    Key: {userId: userId},
    ReturnValues: 'NONE',
    UpdateExpression: 'ADD #DID :did',
    TableName: tableName
  }
}

export function updateUserDeviceParams(tableName: string, userId: string, userDevice: Device): DocumentClient.UpdateItemInput {
  return {
    TableName: tableName,
    Key: {userId},
    UpdateExpression: 'SET #devices = list_append(if_not_exists(#devices, :empty_list), :devices)',
    ExpressionAttributeNames: {'#devices': 'devices'},
    ExpressionAttributeValues: {
      ':devices': [userDevice],
      ':empty_list': []
    }
  }
}

export function upsertDeviceParams(tableName: string, device: Device): DocumentClient.UpdateItemInput {
  const {deviceId, ...deviceSubset} = device
  const {UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues} = transformObjectToDynamoUpdateQuery(deviceSubset)
  return {
    Key: {deviceId},
    TableName: tableName,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
  }
}

export function queryUserDeviceParams(tableName: string, userId: string): DocumentClient.QueryInput {
  return {
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {':userId': userId}
  }
}

export function queryFileParams(tableName: string, fileId: string): DocumentClient.QueryInput {
  return {
    TableName: tableName,
    KeyConditionExpression: 'fileId = :fileId',
    ExpressionAttributeValues: {':fileId': fileId}
  }
}

export function queryDeviceParams(tableName: string, deviceId: string): DocumentClient.QueryInput {
  return {
    TableName: tableName,
    KeyConditionExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: {':deviceId': deviceId}
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
    ExpressionAttributeValues: {':aa': parseInt(Date.now().toString(), 10)},
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
