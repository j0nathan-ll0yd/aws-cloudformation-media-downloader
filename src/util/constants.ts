export const defaultFile = {
  availableAt: Date.now(),
  size: parseInt(process.env.DefaultFileSize, 10),
  authorName: 'Lifegames',
  fileId: 'default',
  publishDate: new Date().toISOString(),
  key: process.env.DefaultFileName,
  url: process.env.DefaultFileUrl,
  contentType: process.env.DefaultFileContentType,
  authorUser: 'sxephil',
  title: 'Welcome! Tap to download.'
}

export const testContext = {
  callbackWaitsForEmptyEventLoop: true,
  logGroupName: 'The log group for the function.',
  logStreamName: 'The log stream for the function instance.',
  functionName: 'The name of the Lambda function.',
  memoryLimitInMB: "The amount of memory that's allocated for the function. (e.g. 128)",
  functionVersion: 'The version of the function. (e.g. $LATEST)',
  invokeid: '55cb4a4e-f810-48f5-b4ad-e2039b4e686e',
  awsRequestId: '55cb4a4e-f810-48f5-b4ad-e2039b4e686e',
  invokedFunctionArn: "The Amazon Resource Name (ARN) that's used to invoke the function. Indicates if the invoker specified a version number or alias."
}
