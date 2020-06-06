import {IdentityProviderApple, User} from '../types/main'

export function updateCompletedFileParams(tableName, fileId, fileName) {
  return {
    ExpressionAttributeNames: { '#FN': 'fileName' },
    ExpressionAttributeValues: { ':fn': fileName },
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
      '#FN': 'fileName'
    },
    ExpressionAttributeValues: {
      ':aa': Date.now().toString()
    },
    FilterExpression: '#AA <= :aa AND attribute_not_exists(#FN)',
    ProjectionExpression: '#AA, #FID',
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
