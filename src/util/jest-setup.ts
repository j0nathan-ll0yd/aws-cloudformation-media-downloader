import {beforeAll, afterAll, jest} from '@jest/globals'

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

// Randomly generated key; not actually used anywhere (safe)
// openssl ecparam -name prime256v1 -genkey -noout -out private.ec.key
// openssl ec -in private.ec.key -pubout -out public.ec.key
export const fakePrivateKey = `
-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIF8qMhsznLgSjN49y4F1cmJZapGowo+PA33LR03WqIhroAoGCCqGSM49
AwEHoUQDQgAES1HCPTVyKI7fwl1Muq0ydgYqNpaFjHVKbDT+efytL6HYw+IWsMV/
X7Osbx+t4v7TzjVyKsLbMIwZ2GuRXg1QpA==
-----END EC PRIVATE KEY-----
`
export const fakePublicKey = `
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAES1HCPTVyKI7fwl1Muq0ydgYqNpaF
jHVKbDT+efytL6HYw+IWsMV/X7Osbx+t4v7TzjVyKsLbMIwZ2GuRXg1QpA==
-----END PUBLIC KEY-----
`

const originalLog = console.log

beforeAll(() => {
  console.log = jest.fn()
})

afterAll(() => {
  console.log = originalLog
})
