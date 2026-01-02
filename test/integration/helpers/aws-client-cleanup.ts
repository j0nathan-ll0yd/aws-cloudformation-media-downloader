/**
 * AWS SDK Client Cleanup
 *
 * Destroys all AWS SDK v3 clients used in integration tests to prevent
 * connection leaks during parallel test execution.
 *
 * Each vendor wrapper module exports a destroyClient() function that this
 * module calls during global teardown.
 */

/**
 * Destroys all AWS SDK clients used in integration tests.
 * Call this in globalTeardown to release HTTP connections.
 */
export async function destroyAllClients(): Promise<void> {
  // Import vendor wrappers and call their destroy functions
  // Using dynamic imports to avoid circular dependencies
  const [sqsModule, eventBridgeModule, snsModule, s3Module, dynamoDBModule] = await Promise.all([
    import('../lib/vendor/AWS/SQS'),
    import('../lib/vendor/AWS/EventBridge'),
    import('../lib/vendor/AWS/SNS'),
    import('../lib/vendor/AWS/S3'),
    import('../lib/vendor/AWS/DynamoDB')
  ])

  // Destroy all clients
  sqsModule.destroyClient()
  eventBridgeModule.destroyClient()
  snsModule.destroyClient()
  s3Module.destroyClient()
  dynamoDBModule.destroyClient()
}
