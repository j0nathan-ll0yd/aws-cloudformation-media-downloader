import {z} from 'zod'

/**
 * Validation schemas for Better Auth data before persistence.
 * These schemas validate the data AFTER transformation to ElectroDB format.
 * IDs are marked as required because transformInputData guarantees their existence.
 */

const IdentityProviderSchema = z.object({
  userId: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  isPrivateEmail: z.boolean(),
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.string(),
  expiresAt: z.number()
})

export const UserSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  emailVerified: z.boolean().default(false),
  firstName: z.string().default(''),
  lastName: z.string().optional(),
  appleDeviceId: z.string().optional(),
  identityProviders: IdentityProviderSchema.optional().default({
    userId: '',
    email: '',
    emailVerified: false,
    isPrivateEmail: false,
    accessToken: '',
    refreshToken: '',
    tokenType: '',
    expiresAt: 0
  }),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional()
})

export const SessionSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string(),
  token: z.string(),
  expiresAt: z.number(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  deviceId: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional()
})

export const AccountSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string(),
  providerId: z.string(),
  providerAccountId: z.string(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  scope: z.string().optional(),
  tokenType: z.string().optional(),
  idToken: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional()
})

export const VerificationTokenSchema = z.object({token: z.string(), identifier: z.string(), expiresAt: z.number(), createdAt: z.number().optional()})
