/**
 * Request/Input Types
 *
 * API request payloads and mutation inputs.
 * Follows the *Input naming convention per AGENTS.md.
 *
 * @see src/types/schemas.ts for Zod validation schemas
 */

// Re-export input types from schemas
export type { FeedlyEventInput } from './schemas'
export type { RegisterDeviceInput } from './schemas'
export type { UserSubscribeInput } from './schemas'
export type { RegisterUserInput } from './schemas'
export type { LoginUserInput } from './schemas'

// Re-export aliased input types
export type { DeviceRegistrationInput } from './schemas'
export type { LoginInput } from './schemas'
export type { RegistrationInput } from './schemas'
export type { SubscriptionInput } from './schemas'
export type { FeedlyWebhookInput } from './schemas'
