import type {Context} from 'aws-lambda'

export const partSize = 1024 * 1024 * 5
export const fakeJWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMDAxODUuNzcyMDMxNTU3MGZjNDlkOTlhMjY1ZjlhZjRiNDY4NzkuMjAzNCJ9.wtotJzwuBIEHfBZssiA18NNObn70s9hk-M_ClRMXc8M'

/** Default test context values */
const defaultContext: Context = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'TestFunction',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:TestFunction',
  memoryLimitInMB: '256',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/TestFunction',
  logStreamName: '2024/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
}

/**
 * Creates a mock Lambda context with optional overrides.
 * Use this instead of duplicating context creation in tests.
 */
export function createMockContext(overrides: Partial<Context> = {}): Context {
  return {...defaultContext, ...overrides}
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
