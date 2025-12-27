import {z} from 'zod'

// YouTube URL regex pattern
const youtubeUrlPattern = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(?:-nocookie)?\.com|youtu.be))(\/(?:[\w-]+\?v=|embed\/|live\/|v\/)?)([\w-]+)(\S+)?$/

export const feedlyEventSchema = z.object({articleURL: z.string().regex(youtubeUrlPattern, 'is not a valid YouTube URL')})

export const registerDeviceSchema = z.object({
  deviceId: z.string().min(1),
  token: z.string().min(1),
  name: z.string().min(1),
  systemName: z.string().min(1),
  systemVersion: z.string().min(1)
})

export const userSubscribeSchema = z.object({endpointArn: z.string().min(1), topicArn: z.string().min(1)})

export const registerUserSchema = z.object({idToken: z.string().min(1), firstName: z.string().optional(), lastName: z.string().optional()})

export const loginUserSchema = z.object({idToken: z.string().min(1)})

/** Feedly webhook event payload with YouTube article URL */
export type FeedlyEventInput = z.infer<typeof feedlyEventSchema>
/** Device registration payload for push notification setup */
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>
/** User subscription payload for SNS topic subscription */
export type UserSubscribeInput = z.infer<typeof userSubscribeSchema>
/** User registration payload with Apple Sign-In token */
export type RegisterUserInput = z.infer<typeof registerUserSchema>
/** User login payload with Apple Sign-In token */
export type LoginUserInput = z.infer<typeof loginUserSchema>
