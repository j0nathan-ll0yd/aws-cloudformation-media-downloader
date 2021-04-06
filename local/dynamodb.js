var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient()

var deviceRegistration = {
  "systemVersion":"14.4",
  "systemName":"iOS",
  "name":"Programmer's iPhone",
  "token":"bf78d60839330e33a555b17be6628a16accb3027073a1d901536694f895561be",
  "UUID":"C49BA68B-E21A-4AEE-8D22-D99A2689B56A"
}

var userId = "e68d2181-c652-43f1-bbf7-30c75d3befb6"
var userDevice = {...deviceRegistration, endpointArn: 'test'}

var queryParams = {
  TableName: 'UserDevices',
  KeyConditionExpression: 'userId = :userId',
  FilterExpression: 'contains(userDevice, :userDevice)',
  ExpressionAttributeValues: {
    ':userId': userId,
    ':userDevice': userDevice
  }
}

docClient.query(queryParams, function(err, data) {
  if (err) console.log(err, err.stack);
  else     console.log(JSON.stringify(data, null, 2));
  if (data.Count === 0) {
    var userFilesQuery = {
      TableName: "UserDevices",
      Key: { userId: userId },
      UpdateExpression: "SET #userDevice = list_append(if_not_exists(#userDevice, :empty_list), :userDevice)",
      ExpressionAttributeNames: { "#userDevice" : "userDevice" },
      ExpressionAttributeValues: { ":userDevice": [userDevice], ":empty_list": [] }
    };
    docClient.update(userFilesQuery, function(err, data) {
      if (err) console.log(err, err.stack);
      else     console.log(JSON.stringify(data, null, 2));
    });
  }
});
