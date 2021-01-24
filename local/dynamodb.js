var AWS = require('aws-sdk');
var ytdl = require('ytdl-core');
var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
var docClient = new AWS.DynamoDB.DocumentClient()

var fileUrl = "https://www.youtube.com/watch?v=IJMl6lz8nDg";
var fileId = ytdl.getURLVideoID(fileUrl);
console.log(fileId);

var now = Date.now(); // Unix timestamp in milliseconds
console.log( now );

var oldTime = now - 100000;


var updateItem = {
  ExpressionAttributeNames: {
    "#FN": "fileName"
  },
  ExpressionAttributeValues: {
    ":fn": { S: "test1.mp4" }
  },
  Key: { "fileId": { S: fileId } },
  ReturnValues: "ALL_NEW",
  TableName: "Files",
  UpdateExpression: "SET #FN = :fn"
};
dynamodb.updateItem(updateItem, function(err, data) {
  if (err) console.log(err, err.stack);
  else     console.log(data);
});

var updateItem = {
  ExpressionAttributeNames: { '#FID': 'fileId' },
  ExpressionAttributeValues: { ':fid': docClient.createSet([fileId]) },
  Key: { 'userId': '1' },
  ReturnValues: 'NONE',
  UpdateExpression: 'ADD #FID :fid',
  TableName: 'UserFiles'
};
docClient.update(updateItem, function(err, data) {
  if (err) console.log(err, err.stack);
  else     console.log(data);
});

var queryParams = {
  ExpressionAttributeNames: {
    "#AA": "availableAt",
    "#FN": "fileName",
    "#FID": "fileId"
  },
  ExpressionAttributeValues: {
    ":aa": { S: oldTime.toString() },
  },
  //FilterExpression: "#AA <= :aa AND attribute_not_exists(#FN)",
  FilterExpression: "#AA <= :aa",
  ProjectionExpression: "#AA, #FN, #FID",
  TableName: "Files"
};
dynamodb.scan(queryParams, function(err, data) {
  if (err) console.log(err, err.stack);
  else     console.log(data, 2, null);
});


var initalItem = {
  ExpressionAttributeNames: { "#AA": "availableAt" },
  ExpressionAttributeValues: { ':aa': { S: Date.now().toString() } },
  Key: { 'fileId': { S: fileId } },
  ReturnValues: 'ALL_OLD',
  UpdateExpression: 'SET #AA = if_not_exists(#AA, :aa)',
  TableName: "Files"
};
dynamodb.updateItem(initalItem, function(err, data) {
  if (err) console.log(err, err.stack);
  else     console.log(data);
  // If there are return values, its done, send another error
});

