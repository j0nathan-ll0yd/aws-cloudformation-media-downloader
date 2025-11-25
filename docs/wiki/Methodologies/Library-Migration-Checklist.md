# Library Migration Checklist

## Quick Reference
- **When to use**: Migrating from one library/dependency to another
- **Enforcement**: Required for major library changes
- **Impact if violated**: HIGH - Breaking changes, data loss, production issues

## Overview

A systematic approach to safely migrate from one library to another while maintaining system stability. This checklist ensures zero-downtime migrations with proper testing and rollback procedures.

## Migration Phases

### Phase 1: Planning

Understand what you're migrating and why.

### Phase 2: Parallel Implementation

New implementation alongside the old.

### Phase 3: Incremental Migration

Gradual cutover with feature flags.

### Phase 4: Validation

Verify correctness at each step.

### Phase 5: Deprecation

Remove old implementation.

## The Checklist

### 📋 Pre-Migration

- [ ] **Document current implementation**
  - Current library version
  - All usage locations
  - Known issues/limitations
  - Performance baselines

- [ ] **Assess new library**
  - Feature parity check
  - Performance comparison
  - Security audit
  - License compatibility

- [ ] **Create migration plan**
  - Timeline with milestones
  - Rollback procedures
  - Success criteria
  - Risk assessment

### 🔧 Implementation

- [ ] **Install new library**
  ```bash
  npm install new-library
  npm install --save-dev @types/new-library  # If TypeScript
  ```

- [ ] **Create compatibility layer**
  ```typescript
  // lib/vendor/Migration/CompatibilityLayer.ts
  export interface UnifiedInterface {
    // Common interface both libraries can implement
  }
  ```

- [ ] **Implement adapter pattern**
  ```typescript
  // Old implementation
  export class OldLibraryAdapter implements UnifiedInterface {
    // Wraps old library
  }

  // New implementation
  export class NewLibraryAdapter implements UnifiedInterface {
    // Wraps new library
  }
  ```

- [ ] **Add feature flag**
  ```typescript
  const useNewLibrary = process.env.USE_NEW_LIBRARY === 'true'
  export const adapter = useNewLibrary
    ? new NewLibraryAdapter()
    : new OldLibraryAdapter()
  ```

### 🧪 Testing

- [ ] **Unit tests for new implementation**
  ```typescript
  describe('NewLibraryAdapter', () => {
    it('should match old behavior', () => {
      // Test parity
    })
  })
  ```

- [ ] **Integration tests**
  ```typescript
  describe('Library Migration', () => {
    it('should work with old library', () => {
      process.env.USE_NEW_LIBRARY = 'false'
      // Test
    })

    it('should work with new library', () => {
      process.env.USE_NEW_LIBRARY = 'true'
      // Test
    })
  })
  ```

- [ ] **Performance tests**
  ```typescript
  // Compare performance metrics
  const oldMetrics = await runWithOldLibrary()
  const newMetrics = await runWithNewLibrary()
  expect(newMetrics.duration).toBeLessThan(oldMetrics.duration * 1.1)
  ```

- [ ] **Load testing**
  - Test under production-like load
  - Monitor memory usage
  - Check for memory leaks

### 🚀 Deployment

- [ ] **Stage 1: Deploy with flag off**
  ```bash
  USE_NEW_LIBRARY=false npm run deploy
  ```
  - New code deployed but not active
  - Verify no impact

- [ ] **Stage 2: Canary deployment**
  ```typescript
  // Route 10% traffic to new library
  const useNewLibrary = Math.random() < 0.1
  ```
  - Monitor error rates
  - Track performance metrics

- [ ] **Stage 3: Gradual rollout**
  - 10% → 25% → 50% → 100%
  - Monitor at each stage
  - Ready to rollback

- [ ] **Stage 4: Full deployment**
  ```bash
  USE_NEW_LIBRARY=true npm run deploy
  ```

### 📊 Validation

- [ ] **Monitor production metrics**
  - Error rates
  - Response times
  - Memory usage
  - CPU utilization

- [ ] **Check data integrity**
  ```typescript
  // Verify data migration if applicable
  const oldData = await oldLibrary.getData()
  const newData = await newLibrary.getData()
  expect(newData).toEqual(oldData)
  ```

- [ ] **User acceptance testing**
  - No visible changes to users
  - Performance acceptable
  - All features working

### 🗑️ Cleanup

- [ ] **Remove feature flag**
  ```typescript
  // Remove conditional logic
  export const adapter = new NewLibraryAdapter()
  ```

- [ ] **Remove old library**
  ```bash
  npm uninstall old-library
  ```

- [ ] **Remove compatibility layer**
  - Delete adapter interfaces
  - Clean up migration code

- [ ] **Update documentation**
  - Update README
  - Update wiki pages
  - Update API docs

## Real-World Example: DynamoDB Helpers → ElectroDB

### Phase 1: Planning

```markdown
## Migration Plan: DynamoDB → ElectroDB

**Why**:
- Type safety
- Better query builder
- Simpler relationships

**Scope**:
- 15 Lambda functions
- 3 DynamoDB tables
- 2000+ lines of code

**Timeline**: 4 weeks
```

### Phase 2: Parallel Implementation

```typescript
// Old DynamoDB SDK approach (before migration)
import {DynamoDBClient, GetItemCommand} from '@aws-sdk/client-dynamodb'

export async function getFile(fileId: string) {
  return dynamoClient.send(new GetItemCommand({
    TableName: process.env.DynamoDBTableName,
    Key: {fileId: {S: fileId}}
  }))
}

// src/entities/Files.ts (new ElectroDB approach)
import {Entity} from 'electrodb'
import {documentClient} from '../lib/vendor/ElectroDB/entity'

export const Files = new Entity({
  model: {
    entity: 'File',
    version: '1',
    service: 'MediaDownloader'
  },
  attributes: {
    fileId: {type: 'string', required: true, readOnly: true},
    status: {type: ['PendingMetadata', 'PendingDownload', 'Downloaded', 'Failed'] as const},
    // ... other attributes
  },
  indexes: {
    primary: {
      pk: {field: 'pk', composite: ['fileId']},
      sk: {field: 'sk', composite: []}
    },
    byStatus: {
      index: 'StatusIndex',
      pk: {field: 'gsi4pk', composite: ['status']},
      sk: {field: 'gsi4sk', composite: ['availableAt']}
    }
  }
}, {
  table: process.env.DynamoDBTableName,
  client: documentClient
})
```

### Phase 3: Incremental Migration

```typescript
// src/lambdas/ListFiles/src/index.ts - Using ElectroDB patterns
import {Files} from '../../../entities/Files'
import {UserFiles} from '../../../entities/UserFiles'

// Start with read operations using ElectroDB
async function getFilesByUser(userId: string): Promise<DynamoDBFile[]> {
  // Query using ElectroDB's type-safe query builder
  const userFilesResponse = await UserFiles.query.byUser({userId}).go()

  if (!userFilesResponse?.data?.length) {
    return []
  }

  // Batch get files using ElectroDB
  const fileKeys = userFilesResponse.data.map((userFile) => ({fileId: userFile.fileId}))
  const {data: files, unprocessed} = await Files.get(fileKeys).go({concurrency: 5})

  if (unprocessed.length > 0) {
    logDebug('Unprocessed files', unprocessed)
  }

  return files as DynamoDBFile[]
}

// Write operations using ElectroDB upsert
async function upsertDevice(device: Device) {
  return Devices.upsert({
    deviceId: device.deviceId,
    endpointArn: device.endpointArn,
    token: device.token,
    name: device.name,
    systemVersion: device.systemVersion,
    systemName: device.systemName
  }).go()
}
```

### Phase 4: Validation

```typescript
// src/lambdas/ListFiles/test/index.test.ts
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'

describe('ElectroDB Entity Testing', () => {
  // Create mocks with proper query indexes
  const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
  const filesMock = createElectroDBEntityMock()

  // Mock the entities
  jest.unstable_mockModule('../../../entities/UserFiles', () => ({
    UserFiles: userFilesMock.entity
  }))
  jest.unstable_mockModule('../../../entities/Files', () => ({
    Files: filesMock.entity
  }))

  it('should handle batch get operations', async () => {
    const mockFiles = [{fileId: '123', status: 'Downloaded'}]
    filesMock.mocks.get.mockResolvedValue({
      data: mockFiles,
      unprocessed: []
    })

    const {handler} = await import('../src')
    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    expect(filesMock.mocks.get).toHaveBeenCalledWith(
      expect.arrayContaining([{fileId: expect.any(String)}])
    )
  })

  it('should handle query operations', async () => {
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({
      data: [{userId: 'user123', fileId: 'file456'}]
    })

    const result = await UserFiles.query.byUser({userId: 'user123'}).go()
    expect(result.data).toHaveLength(1)
  })
})
```

### Phase 5: Cleanup

```diff
// package.json
{
  "dependencies": {
-   "@aws-sdk/lib-dynamodb": "^3.0.0",
+   "electrodb": "^2.0.0"
  }
}
```

## Common Migration Patterns

### Database Migrations

- Use dual writes during transition
- Backfill historical data
- Verify data integrity

### API Client Migrations

- Implement retry logic for both
- Map error codes
- Handle rate limiting

### Testing Framework Migrations

- Run both frameworks in parallel
- Port tests incrementally
- Maintain coverage

### Build Tool Migrations

- Keep both configs temporarily
- Verify output equivalence
- Update CI/CD gradually

## Rollback Procedures

### Immediate Rollback

```bash
# Feature flag rollback
USE_NEW_LIBRARY=false npm run deploy
```

### Data Rollback

```typescript
// If data migration is involved
export async function rollbackData() {
  // Restore from backup
  // Reverse transformations
  // Verify integrity
}
```

### Code Rollback

```bash
# Git revert if necessary
git revert <migration-commit>
git push
```

## Risk Mitigation

### High-Risk Indicators

- ❌ No compatibility layer
- ❌ Big-bang migration
- ❌ No feature flags
- ❌ Insufficient testing
- ❌ No rollback plan

### Low-Risk Approach

- ✅ Incremental migration
- ✅ Feature flags for control
- ✅ Comprehensive testing
- ✅ Monitoring at each stage
- ✅ Clear rollback procedures

## Tools and Utilities

### Migration Scripts

```bash
#!/bin/bash
# scripts/migration-status.sh

echo "Migration Status:"
echo "Old Library Usage: $(grep -r 'old-library' src/ | wc -l)"
echo "New Library Usage: $(grep -r 'new-library' src/ | wc -l)"
echo "Feature Flag: $USE_NEW_LIBRARY"
```

### Monitoring Dashboards

```typescript
// CloudWatch dashboard for migration metrics
const dashboard = {
  widgets: [
    {metric: 'OldLibrary.Invocations'},
    {metric: 'NewLibrary.Invocations'},
    {metric: 'Migration.Errors'}
  ]
}
```

## Post-Migration

### Success Criteria

- [ ] All tests passing
- [ ] Performance metrics acceptable
- [ ] No increase in errors
- [ ] Old library fully removed
- [ ] Documentation updated

### Lessons Learned

Document:
- What went well
- What was challenging
- Time estimates vs actual
- Improvements for next migration

## Related Patterns

- [Testing Strategy](../Testing/Jest-ESM-Mocking-Strategy.md) - Testing during migration
- [Feature Flags](Convention-Over-Configuration.md) - Using flags for gradual rollout
- [Monitoring](Production-Debugging.md) - Tracking migration success
- [ElectroDB Integration](../AWS/SDK-Encapsulation-Policy.md) - Current library patterns

## Enforcement

- **Pull Request Template**: Migration checklist items
- **Code Review**: Verify incremental approach
- **CI/CD Gates**: Block deployment without tests
- **Monitoring Alerts**: Track migration metrics

---

*Migrate incrementally, test thoroughly, rollback quickly.*