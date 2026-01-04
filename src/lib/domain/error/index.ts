export { classifyAuthError } from './authErrorClassifier'
export { classifyDatabaseError } from './databaseErrorClassifier'
export { classifyExternalApiError } from './externalApiErrorClassifier'
export type { ClassifyErrorOptions, ErrorDomain } from '#types/errorClassification'

import type {ClassifyErrorOptions, ErrorClassification, ErrorDomain} from '#types/errorClassification'
import {classifyAuthError} from './authErrorClassifier'
import {classifyDatabaseError} from './databaseErrorClassifier'
import {classifyExternalApiError} from './externalApiErrorClassifier'

/**
 * Unified error classifier that routes to domain-specific classifiers.
 * Provides consistent error classification across all domains.
 *
 * @param error - The error to classify
 * @param domain - The domain the error originated from
 * @param options - Additional options (e.g., serviceName for external APIs)
 * @returns Classification with retry strategy and issue creation guidance
 *
 * @example
 * classifyError(error, 'auth')
 * classifyError(error, 'database')
 * classifyError(error, 'external-api', \{serviceName: 'GitHub'\})
 */
export function classifyError(error: Error, domain: ErrorDomain, options?: ClassifyErrorOptions): ErrorClassification {
  switch (domain) {
    case 'auth':
      return classifyAuthError(error)
    case 'database':
      return classifyDatabaseError(error)
    case 'external-api':
      return classifyExternalApiError(error, options?.serviceName || 'external')
  }
}
