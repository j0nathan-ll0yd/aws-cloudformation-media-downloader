import {z} from 'zod'

// YouTube URL regex pattern
const youtubeUrlPattern = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(?:-nocookie)?\.com|youtu.be))(\/(?:[\w-]+\?v=|embed\/|live\/|v\/)?)([\w-]+)(\S+)?$/

export const feedlyEventSchema = z.object({
  articleURL: z.string().regex(youtubeUrlPattern, 'is not a valid YouTube URL'),
  backgroundMode: z.boolean().optional()
})

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

// Type exports inferred from schemas
export type FeedlyEventInput = z.infer<typeof feedlyEventSchema>
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>
export type UserSubscribeInput = z.infer<typeof userSubscribeSchema>
export type RegisterUserInput = z.infer<typeof registerUserSchema>
export type LoginUserInput = z.infer<typeof loginUserSchema>

// Helper function to validate data against a schema
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): {errors: Record<string, string[]>} | null {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errorHash: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'unknown'
      if (!errorHash[path]) {
        errorHash[path] = [issue.message]
      } else {
        errorHash[path].push(issue.message)
      }
    }
    return {errors: errorHash}
  }
  return null
}
