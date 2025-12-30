/**
 * Failure Injection Helpers
 *
 * Utilities for testing error handling in integration tests.
 * Provides controlled failure injection for database and external services.
 */
import {vi, type Mock} from 'vitest'

/**
 * Creates a mock function that fails after N successful calls.
 *
 * @param successfulCalls - Number of calls before failing
 * @param successValue - Value to return for successful calls
 * @param errorMessage - Error message for failures
 */
export function createFailingAfterNMock<T>(successfulCalls: number, successValue: T, errorMessage = 'Injected failure'): Mock {
  let callCount = 0

  return vi.fn().mockImplementation(() => {
    callCount++
    if (callCount > successfulCalls) {
      throw new Error(errorMessage)
    }
    return Promise.resolve(successValue)
  })
}

/**
 * Creates a mock function that fails intermittently.
 *
 * @param failureRate - Probability of failure (0.0 to 1.0)
 * @param successValue - Value to return for successful calls
 * @param errorMessage - Error message for failures
 */
export function createIntermittentFailureMock<T>(failureRate: number, successValue: T, errorMessage = 'Intermittent failure'): Mock {
  return vi.fn().mockImplementation(() => {
    if (Math.random() < failureRate) {
      throw new Error(errorMessage)
    }
    return Promise.resolve(successValue)
  })
}

/**
 * Creates a mock that simulates network timeout.
 *
 * @param timeoutMs - Time before timeout error
 */
export function createTimeoutMock(timeoutMs: number): Mock {
  return vi.fn().mockImplementation(() => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })
  })
}

/**
 * Creates a mock that rejects with a specific error.
 *
 * @param error - Error to throw
 */
export function createRejectingMock(error: Error): Mock {
  return vi.fn().mockRejectedValue(error)
}

/**
 * Creates a mock that returns an empty/null result.
 * Useful for testing "not found" scenarios.
 */
export function createEmptyResultMock(): Mock {
  return vi.fn().mockResolvedValue(null)
}

/**
 * Creates a mock that returns an array with empty results.
 */
export function createEmptyArrayMock(): Mock {
  return vi.fn().mockResolvedValue([])
}

/**
 * SNS Failure Types for simulating AWS errors
 */
export const SNS_ERRORS = {
  EndpointDisabled: {
    name: 'EndpointDisabledException',
    statusCode: 400,
    message: 'Endpoint is disabled'
  },
  InvalidParameter: {
    name: 'InvalidParameterException',
    statusCode: 400,
    message: 'Invalid parameter'
  },
  NotFound: {
    name: 'NotFoundException',
    statusCode: 404,
    message: 'Resource not found'
  },
  Throttled: {
    name: 'ThrottledException',
    statusCode: 429,
    message: 'Rate exceeded'
  }
} as const

/**
 * SQS Failure Types for simulating AWS errors
 */
export const SQS_ERRORS = {
  QueueDoesNotExist: {
    name: 'QueueDoesNotExist',
    statusCode: 400,
    message: 'The specified queue does not exist'
  },
  MessageNotInflight: {
    name: 'MessageNotInflight',
    statusCode: 400,
    message: 'The message referred to is not in flight'
  },
  Throttled: {
    name: 'OverLimit',
    statusCode: 429,
    message: 'The maximum number of in-flight messages is reached'
  }
} as const

/**
 * EventBridge Failure Types for simulating AWS errors
 */
export const EVENTBRIDGE_ERRORS = {
  ResourceNotFound: {
    name: 'ResourceNotFoundException',
    statusCode: 404,
    message: 'Rule not found'
  },
  Throttled: {
    name: 'ThrottledRequest',
    statusCode: 429,
    message: 'Request rate exceeded'
  },
  InternalError: {
    name: 'InternalException',
    statusCode: 500,
    message: 'Internal service error'
  }
} as const

/**
 * Creates an AWS SDK-style error object
 */
export function createAwsError(
  errorType: {name: string; statusCode: number; message: string},
  details?: Record<string, unknown>
): Error {
  const error = new Error(errorType.message) as Error & {
    name: string
    $metadata: {httpStatusCode: number}
    Code: string
    $fault: string
  }
  error.name = errorType.name
  error.$metadata = {httpStatusCode: errorType.statusCode, ...details}
  error.Code = errorType.name
  error.$fault = errorType.statusCode >= 500 ? 'server' : 'client'
  return error
}

/**
 * Creates a mock that fails with an AWS SDK-style error
 */
export function createAwsErrorMock(errorType: {name: string; statusCode: number; message: string}): Mock {
  return vi.fn().mockRejectedValue(createAwsError(errorType))
}
