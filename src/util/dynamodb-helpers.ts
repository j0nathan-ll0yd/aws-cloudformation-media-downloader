export function updateCompletedItemParams(tableName, fileId, fileName) {
  return {
    ExpressionAttributeNames: { '#FN': 'fileName' },
    ExpressionAttributeValues: { ':fn': { S: fileName } },
    Key: { 'fileId': { S: fileId } },
    ReturnValues: 'ALL_NEW',
    TableName: tableName,
    UpdateExpression: 'SET #FN = :fn'
  }
}

export function scanForItemParams(tableName) {
  return {
    ExpressionAttributeNames: {
      '#AA': 'availableAt',
      '#FID': 'fileId',
      '#FN': 'fileName'
    },
    ExpressionAttributeValues: {
      ':aa': { S: Date.now().toString() }
    },
    FilterExpression: '#AA <= :aa AND attribute_not_exists(#FN)',
    ProjectionExpression: '#AA, #FID',
    TableName: tableName
  }
}

export function newItemParams(tableName, fileId) {
  return {
    ExpressionAttributeNames: { '#AA': 'availableAt' },
    ExpressionAttributeValues: { ':aa': { S: Date.now().toString() } },
    Key: { 'fileId': { S: fileId } },
    ReturnValues: 'ALL_OLD',
    UpdateExpression: 'SET #AA = if_not_exists(#AA, :aa)',
    TableName: tableName
  }
}
