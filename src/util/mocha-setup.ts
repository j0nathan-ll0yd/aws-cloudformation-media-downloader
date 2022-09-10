import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import * as fs from 'fs'
import * as path from 'path'
chai.use(chaiAsPromised)

// eslint-disable-next-line @typescript-eslint/ban-types
export function getFixture(dir: string, file: string): object {
  const fixturePath = path.resolve(dir, 'fixtures')
  return JSON.parse(fs.readFileSync(`${fixturePath}/${file}`, 'utf8'))
}

export const partSize = 1024 * 1024 * 5
export const fakeJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMDAxODUuNzcyMDMxNTU3MGZjNDlkOTlhMjY1ZjlhZjRiNDY4NzkuMjAzNCJ9.wtotJzwuBIEHfBZssiA18NNObn70s9hk-M_ClRMXc8M'
export const testContext = {
  callbackWaitsForEmptyEventLoop: true,
  logGroupName: 'The log group for the function.',
  logStreamName: 'The log stream for the function instance.',
  functionName: 'The name of the Lambda function.',
  memoryLimitInMB: "The amount of memory that's allocated for the function. (e.g. 128)",
  functionVersion: 'The version of the function. (e.g. $LATEST)',
  invokeid: '55cb4a4e-f810-48f5-b4ad-e2039b4e686e',
  awsRequestId: '55cb4a4e-f810-48f5-b4ad-e2039b4e686e',
  invokedFunctionArn: "The Amazon Resource Name (ARN) that's used to invoke the function. Indicates if the invoker specified a version number or alias.",
  getRemainingTimeInMillis: () => {
    return 300
  },
  done: () => {
    return
  },
  fail: () => {
    return
  },
  succeed: () => {
    return
  }
}
