import {RateLimits} from '../entities/RateLimits'
import {logDebug} from './lambda-helpers'
import {TooManyRequestsError} from './errors'

/**
 * Checks rate limit for an endpoint/identifier combination
 * @param endpoint - The endpoint being rate limited
 * @param identifier - User identifier (email, userId, IP)
 * @param maxRequests - Maximum requests allowed in window
 * @param windowSeconds - Window size in seconds
 * @throws TooManyRequestsError if limit exceeded
 */
export async function checkRateLimit(endpoint: string, identifier: string, maxRequests: number, windowSeconds: number): Promise<void> {
  const now = Date.now()
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000)
  const key = `${endpoint}:${identifier}:${windowStart}`
  const ttl = Math.floor((windowStart + windowSeconds * 1000) / 1000) + 60

  logDebug('checkRateLimit', {key, maxRequests, windowSeconds})

  try {
    const result = await RateLimits.get({key}).go()
    const rateLimit = result.data

    if (rateLimit) {
      if (rateLimit.requests >= maxRequests) {
        throw new TooManyRequestsError(`Rate limit exceeded. Try again in ${windowSeconds} seconds.`)
      }

      await RateLimits.update({key}).add({requests: 1}).go()
    } else {
      await RateLimits.create({
        key,
        requests: 1,
        windowStart,
        ttl
      }).go()
    }
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      throw error
    }
    logDebug('checkRateLimit.error', error)
  }
}
