import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import * as fs from 'fs'
import * as path from 'path'
import * as sinon from 'sinon'
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

export const fakeCertificate = `
-----BEGIN CERTIFICATE-----
MIIFyjCCA7ICCQC7nf/riuMNIDANBgkqhkiG9w0BAQsFADCBpjELMAkGA1UEBhMC
VVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28x
KjAoBgNVBAoMIUxpZmVnYW1lcyBXZWIgRGVzaWduICYgQ29uc3VsdGluZzEWMBQG
A1UEAwwNbGlmZWdhbWVzLm9yZzEmMCQGCSqGSIb3DQEJARYXd2VibWFzdGVyQGxp
ZmVnYW1lcy5vcmcwHhcNMjIxMDI1MjI0MTU1WhcNMjMxMDI1MjI0MTU1WjCBpjEL
MAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDVNhbiBG
cmFuY2lzY28xKjAoBgNVBAoMIUxpZmVnYW1lcyBXZWIgRGVzaWduICYgQ29uc3Vs
dGluZzEWMBQGA1UEAwwNbGlmZWdhbWVzLm9yZzEmMCQGCSqGSIb3DQEJARYXd2Vi
bWFzdGVyQGxpZmVnYW1lcy5vcmcwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK
AoICAQCv/5knWx3GyqsNwL98ZZVFsWMvoGYs0f/tzrNupZCJ0hr+UMFTt8/rmWAd
QQZ7VAudaZvJmksh2n66lohZdHoW+mtzTV5cDU4BnVq1i96Jv2LWlYWnxs2t85Sp
02rRmt9/JRh4LeO1JRrbqzco5wrQvsOTcrHnZvpRRUCQEpqGPGjEqfnWtXYaYCqZ
exVVXYd67RLdpvAv0N0ZQEUSBgBPGXa7hPnp5rx4k64XQM+Rzt0b6lDz3J5JVnyi
Y8bY2bFqKyzBo1G6QzFuuZ7i0MGkWIdZFHtCb/YAK/js+z8Pus8dymuX9IQfITGR
/HOfT5N1GxMXCQBQWsV1IAzVg0yuqBfVWN/MWqqiev058jB8Dz3rsMbyhsWaLg6e
2t2sHOAn8K6hlTMP91NPKsQmTGGnLCJuNBiWRjg5AISm6Sl3ncZ/qU6jAe1kGzjF
m4MeiqCPr8L6BX7g9p9faSk8OsksZt4P1cvZwo6V+WI2fO393dskPcO/v7KBZr3l
1YZiZFQ4cUYJj8YmnwTmRIi8w2bNBORH187HYYkiDjzJES+tsP4TGbLfLOSN5uq9
7pd7a3G9rDwKQxJnpNP1xWOqfu4uD/mLOFvh+phWS5yzHzn6NV4PnS6fPtol+FtC
hX5oPbf6qBzBhmNgD2bauySUbgJHp8/+j4l8TNF7OPwnMCI/cwIDAQABMA0GCSqG
SIb3DQEBCwUAA4ICAQA7pThpKSChgRbTDWQBcL7Cj/obQq0dhS90lMgBp70mpkG9
M+ogDY++GzcGNg4fV9TAOxi3uvHFbQ/hERPfjvE8kTH6CXeiYEYVous1h1vsqmv2
Kl2vzdWeUYFpXgPK5kamkEiLhV9oxWlujaQL1IORqtI2h51b9+AM4Lf8k9VwM/hF
/djggYIZjtmAilRP34j2nXUXjj0jbv5+DGmdbn+sVHNRwn5FIljooxfJkpBp8nA2
6SX5RLYRil++COj/VmkUTDtGEXr/Amlu0Jg8nZKz+nsjPrMscog4vjrEPD6RqWRF
yXoipO1RX2GUG1AygkYy6I0RmtEGT5eLGiSG0B3wByHfBUy80emFylX4ocqnzK/0
/+LsXBel+o1GArMeKFGbTPze1TOJVV6YjUFQswOFbEjJ8KX2UPQo46h10r3K+5Ni
mwyLlnK8/AvZR5myQub+7WvOZVTM42fPLOpvcXxm1NwqNg+WEFXfZRmOU0xlk1UP
wDSi+SsXjw2XVAEhMAASkZ2aYupxm1rTNu0AC4PM2eNrYSvm5vwCnx5TgEkEkEgV
Wm/5g7olr1FNes9DHr3r3F+Dp4sHcOwtKVbNpxvn6Tgt9hFWBGiiw6Kl8Oqov+ih
iaQFVmkLFR5OyqxSlAdRXZGnX/xTu6/A3USRyRQRtrAWcL6U5Q/9JLFCNEXXrw==
-----END CERTIFICATE-----
`

let mochaHooks = {}
if (!process.env.MOCHA_DEBUG) {
  let consoleLogStub: sinon.SinonStub
  let consoleInfoStub: sinon.SinonStub
  let consoleDebugStub: sinon.SinonStub
  let consoleWarnStub: sinon.SinonStub
  let consoleErrorStub: sinon.SinonStub
  mochaHooks = {
    beforeEach(): void {
      consoleLogStub = sinon.stub(console, 'log')
      consoleInfoStub = sinon.stub(console, 'info')
      consoleDebugStub = sinon.stub(console, 'debug')
      consoleWarnStub = sinon.stub(console, 'warn')
      consoleErrorStub = sinon.stub(console, 'error')
    },
    afterEach(): void {
      consoleLogStub.restore()
      consoleInfoStub.restore()
      consoleDebugStub.restore()
      consoleWarnStub.restore()
      consoleErrorStub.restore()
    }
  }
}

export {mochaHooks}
