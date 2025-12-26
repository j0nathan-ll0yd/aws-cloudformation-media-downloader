/**
 * Better Auth Entities Integration Tests
 *
 * SKIPPED: This test suite required DynamoDB with LocalStack.
 * The project has migrated from ElectroDB/DynamoDB to Drizzle/Aurora DSQL.
 * Integration tests for the new Drizzle-based entities will be added
 * using PostgreSQL in a future update.
 *
 * Original tests validated:
 * - Entity CRUD operations
 * - GSI queries (byEmail, byUser, byToken, byProvider)
 * - Collections queries (userSessions, userAccounts)
 * - Complete authentication flows
 */

import {describe, it} from '@jest/globals'

describe('Better Auth Entities Integration Tests', () => {
  it.skip('suite skipped - migrated to Aurora DSQL, requires PostgreSQL integration test setup', () => {
    // Tests need to be rewritten for Drizzle/PostgreSQL instead of ElectroDB/DynamoDB
    // See: https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues/196
  })
})
