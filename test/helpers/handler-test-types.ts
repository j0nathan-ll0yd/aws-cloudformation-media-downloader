/**
 * Type utilities for Lambda handler tests where define*Handler is mocked
 * to pass through the inner function directly.
 *
 * When define*Handler factories are mocked as pass-through, the exported handler
 * is the inner function at runtime but TypeScript sees the outer Lambda signature.
 * These types model the runtime shape for type-safe test assertions.
 *
 * @example
 * ```ts
 * const {handler} = (await import('#lambdas/api/user/subscribe.post.js')) as unknown as MockedHandlerModule
 * ```
 */

/**
 * Permissive result type for mocked handler returns.
 * Uses `any` values to allow deep property access in test assertions (e.g., result.contents[0].fileId).
 * This is intentional — test assertions verify runtime behavior, not compile-time types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerResult = Record<string, any>

/**
 * A mocked handler function: callable with any args, returns a promise of TResult.
 * Default return type allows deep property access in assertions without casts.
 */
export type MockedHandler<TResult = HandlerResult> = (...args: unknown[]) => Promise<TResult>

/** Module shape for most mocked handler imports (single handler export) */
export type MockedHandlerModule<TResult = HandlerResult> = {handler: MockedHandler<TResult>}

/** Policy statement shape for Allow/Deny policies in authorizer tests */
interface PolicyStatement {
  Effect: string
  Action: string
  Resource: string
}

/** Return type of generateAllow in authorizer tests */
interface AuthorizerResult {
  principalId: string
  policyDocument: {Version: string; Statement: PolicyStatement[]}
  usageIdentifierKey?: string
  context: Record<string, string>
}

/** Module shape for the ApiGatewayAuthorizer test (handler + generateAllow) */
export type MockedAuthorizerModule = {
  handler: MockedHandler<AuthorizerResult>
  generateAllow: (principalId: string, resource: string, usageIdentifierKey?: string, authContext?: Record<string, string>) => AuthorizerResult
}
