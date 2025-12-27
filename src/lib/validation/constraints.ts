import {z} from 'zod'

// Helper function to validate data against a schema
/** */
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
