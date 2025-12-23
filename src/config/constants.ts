import type {File} from '#types/domain-models'
import {FileStatus} from '#types/enums'
import {getRequiredEnv, getRequiredEnvNumber} from '#lib/system/env'

// Re-export runtime constants
export * from './runtime'

/**
 * Cached default file to avoid repeated env var lookups
 */
let _defaultFile: File | undefined

/**
 * Returns the default file shown to new/anonymous users.
 * Uses lazy evaluation to avoid module-level env validation that breaks tests.
 * @returns The default file with properties from environment variables
 */
export function getDefaultFile(): File {
  if (!_defaultFile) {
    _defaultFile = {
      fileId: 'default',
      size: getRequiredEnvNumber('DEFAULT_FILE_SIZE'),
      authorName: 'Lifegames',
      authorUser: 'sxephil',
      publishDate: new Date().toISOString(),
      description: 'Description',
      key: getRequiredEnv('DEFAULT_FILE_NAME'),
      url: getRequiredEnv('DEFAULT_FILE_URL'),
      contentType: getRequiredEnv('DEFAULT_FILE_CONTENT_TYPE'),
      title: 'Welcome! Tap to download.',
      status: FileStatus.Downloaded
    }
  }
  return _defaultFile
}
