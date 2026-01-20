/**
 * Lambda Vendor Wrapper
 *
 * Encapsulates AWS Lambda SDK operations with declarative permission metadata.
 * Each method declares the AWS permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda IAM policies.
 *
 * @see src/lib/vendor/AWS/clients.ts for client factory
 * @see src/lib/vendor/AWS/decorators.ts for permission decorators
 */
import {InvokeCommand} from '@aws-sdk/client-lambda'
import type {InvokeCommandInput, InvokeCommandOutput} from '@aws-sdk/client-lambda'
import {createLambdaClient} from './clients'
import {RequiresLambda} from './decorators'
import {LambdaOperation} from '#types/servicePermissions'

const lambda = createLambdaClient()

/**
 * Lambda vendor wrapper with declarative permission metadata.
 * Each method declares the AWS permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda IAM policies.
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
class LambdaVendor {
  @RequiresLambda('*', [LambdaOperation.Invoke])
  static invokeLambda(params: InvokeCommandInput): Promise<InvokeCommandOutput> {
    const command = new InvokeCommand(params)
    return lambda.send(command)
  }

  @RequiresLambda('*', [LambdaOperation.InvokeAsync])
  static async invokeAsync(functionName: string, payload: Record<string, unknown>): Promise<InvokeCommandOutput> {
    const params: InvokeCommandInput = {FunctionName: functionName, InvocationType: 'Event', Payload: JSON.stringify(payload)}
    return LambdaVendor.invokeLambda(params)
  }
}
/* c8 ignore stop */

// Export static methods for backwards compatibility with existing imports
export const invokeLambda = LambdaVendor.invokeLambda.bind(LambdaVendor)
export const invokeAsync = LambdaVendor.invokeAsync.bind(LambdaVendor)

// Export class for extraction script access
export { LambdaVendor }
