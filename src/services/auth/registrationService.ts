/**
 * User Registration Service
 *
 * Handles Better Auth sign-in/registration via Sign in with Apple.
 * Delegates OAuth verification, user creation, and session creation to Better Auth.
 */
import {getAuth} from '@mantleframework/auth'
import {getRequiredEnv} from '@mantleframework/env'
import {UnexpectedError} from '@mantleframework/errors'
import {getDrizzleClient} from '#db/client'
import {accounts, sessions, users, verification} from '#db/schema'
import type {GetSessionResult, SignInSocialTokenResult} from '#types/betterAuth'

/** Result of a successful sign-in/registration */
export interface AuthRegistrationResult {
  token: string
  userId: string
  sessionId: string
  expiresAt: string | Date
  isNewUser: boolean
  user: SignInSocialTokenResult['user']
}

/** Sign in or register a user via Better Auth with Apple ID token */
export async function signInWithApple(idToken: string, ipAddress: string | undefined, userAgent: string): Promise<AuthRegistrationResult> {
  const auth = await getAuth(getDrizzleClient, {
    secret: getRequiredEnv('AUTH_SECRET'),
    baseURL: getRequiredEnv('AUTH_BASE_URL'),
    schema: {user: users, session: sessions, account: accounts, verification},
    socialProviders: {
      apple: {
        clientId: getRequiredEnv('APPLE_CLIENT_ID'),
        clientSecret: getRequiredEnv('APPLE_CLIENT_SECRET'),
        appBundleIdentifier: getRequiredEnv('APPLE_APP_BUNDLE_IDENTIFIER')
      }
    }
  })

  const rawResult = await auth.api.signInSocial({
    headers: {'user-agent': userAgent, 'x-forwarded-for': ipAddress || ''},
    body: {provider: 'apple', idToken: {token: idToken}}
  })

  const result = rawResult as SignInSocialTokenResult
  const sessionResult = await auth.api.getSession({headers: new Headers({Authorization: `Bearer ${result.token}`})}) as GetSessionResult | null

  if (!sessionResult?.session) {
    throw new UnexpectedError('signInSocial succeeded but getSession returned null — is bearer plugin enabled?')
  }

  const isNewUser = !result.user?.createdAt || Date.now() - new Date(result.user.createdAt).getTime() < 5000

  return {
    token: result.token,
    userId: result.user.id,
    sessionId: sessionResult.session.id,
    expiresAt: sessionResult.session.expiresAt,
    isNewUser,
    user: result.user
  }
}
