# Function Spacing

## Quick Reference
- **When to use**: Writing or reviewing function body structure
- **Enforcement**: ESLint Rule + Code Review
- **Impact if violated**: LOW - Inconsistent readability, not functional

## The Rule

**Blank lines separate logical concerns, not individual statements.**

Functions should be compact. Add blank lines only when there's a meaningful logical boundary between sections. Simple sequential operations don't need spacing.

## Core Principles

1. **Logical Grouping** - Group related statements together
2. **Phase Separation** - Use blanks between distinct operation phases
3. **Compact by Default** - When in doubt, omit the blank line
4. **Consistency Over Preference** - Follow patterns, not personal style

---

## Spacing Decision Table

| Situation | Pattern | Blank Line? |
|-----------|---------|-------------|
| Simple sequential ops (1-5 lines) | `const x = get(); log(x); return x` | No |
| Variable initialization → logic | Group vars, then blank, then if/logic | Yes (after vars) |
| Guard clause (early return) | `if (!x) return null; // continue` | No |
| Guard clause → complex logic | Guard, then blank, then body | Yes |
| Distinct logical phases | Setup → blank → fetch → blank → save | Yes (between phases) |
| Try-catch block | `const x = setup(); try { ... }` | No |
| Multiple if-branches (all return) | Each branch separated | Yes (between branches) |
| Comments introducing sections | Blank before comment, then code | Yes (before comment) |
| Before return statements | Complex setups get blank | Sometimes |
| Log before operation result | `log(x); const result = op()` | No |

---

## Pattern Examples

### Simple Sequential Operations (No Blanks)

Functions with 1-5 simple sequential operations need no internal blank lines.

```typescript
// GOOD - Compact, no unnecessary spacing
async function getUser(userId: string): Promise<User | null> {
  logDebug('getUser <=', userId)
  const response = await Users.get({userId}).go()
  logDebug('getUser =>', response)
  return response.data
}

// BAD - Unnecessary spacing in simple function
async function getUser(userId: string): Promise<User | null> {
  logDebug('getUser <=', userId)

  const response = await Users.get({userId}).go()

  logDebug('getUser =>', response)

  return response.data
}
```

### Variable Initialization Phase

Blank line after initialization block before the logic that uses them.

```typescript
// GOOD - Blank separates setup from logic
async function processEvent(event: Event) {
  const fileId = event.fileId
  const userId = event.userId
  const bucket = getRequiredEnv('BUCKET')

  if (!fileId) {
    return buildErrorResponse('Missing fileId')
  }

  const result = await processFile(fileId, userId, bucket)
  return buildResponse(result)
}

// BAD - No separation between setup and logic
async function processEvent(event: Event) {
  const fileId = event.fileId
  const userId = event.userId
  const bucket = getRequiredEnv('BUCKET')
  if (!fileId) {
    return buildErrorResponse('Missing fileId')
  }
  const result = await processFile(fileId, userId, bucket)
  return buildResponse(result)
}
```

### Guard Clauses (Early Returns)

No blank line after simple guard clauses.

```typescript
// GOOD - Compact guard clause
function processValue(value?: string): string {
  if (!value) {
    return ''
  }
  return value.trim().toLowerCase()
}

// GOOD - Also acceptable with single-line guard
function processValue(value?: string): string {
  if (!value) return ''
  return value.trim().toLowerCase()
}

// BAD - Unnecessary blank after guard
function processValue(value?: string): string {
  if (!value) {
    return ''
  }

  return value.trim().toLowerCase()
}
```

**Exception**: Blank line after guard when followed by complex multi-step logic.

```typescript
// GOOD - Blank after guard before complex logic
async function handleRequest(userId?: string) {
  if (!userId) {
    return buildErrorResponse(401, 'Unauthorized')
  }

  // Complex multi-step logic benefits from visual separation
  const user = await Users.get({userId}).go()
  const permissions = await Permissions.query.byUser({userId}).go()
  const settings = await Settings.get({userId}).go()

  return buildResponse({user, permissions, settings})
}
```

### Distinct Logical Phases

Use blanks to separate major operation phases.

```typescript
// GOOD - Clear phase separation
async function downloadAndProcess(fileId: string) {
  // Phase 1: Setup
  const bucket = getRequiredEnv('BUCKET')
  const url = buildVideoUrl(fileId)

  // Phase 2: Download
  logDebug('Downloading', {fileId, url})
  const result = await downloadVideo(url)
  logDebug('Download complete', {fileId, size: result.size})

  // Phase 3: Upload to S3
  const s3Key = `${fileId}.mp4`
  await uploadToS3(bucket, s3Key, result.data)

  // Phase 4: Update database
  await updateFileStatus(fileId, 'downloaded')
  return buildResponse({fileId, status: 'success'})
}
```

### Comments Introducing Sections

Blank line before comment blocks that introduce a new section.

```typescript
// GOOD - Blank before section comments
async function processOrder(order: Order) {
  const orderId = order.id
  const items = order.items

  // Validate inventory
  const availableItems = await checkInventory(items)
  if (availableItems.length !== items.length) {
    return buildErrorResponse('Some items unavailable')
  }

  // Calculate pricing with discounts
  const subtotal = calculateSubtotal(items)
  const discount = await getActiveDiscount(order.userId)
  const total = applyDiscount(subtotal, discount)

  // Persist the order
  await saveOrder({...order, total})
  return buildResponse({orderId, total})
}

// BAD - Comments without preceding blanks
async function processOrder(order: Order) {
  const orderId = order.id
  const items = order.items
  // Validate inventory (should have blank before)
  const availableItems = await checkInventory(items)
  // ... etc
}
```

### Try-Catch Blocks

No blank line before `try` when it immediately follows setup.

```typescript
// GOOD - No blank before try
async function safeFetch(url: string) {
  const timeout = getTimeout()
  try {
    const result = await fetch(url, {timeout})
    return {success: true, data: result}
  } catch (error) {
    logError('Fetch failed', error)
    return {success: false, error}
  }
}

// BAD - Unnecessary blank before try
async function safeFetch(url: string) {
  const timeout = getTimeout()

  try {
    const result = await fetch(url, {timeout})
    return {success: true, data: result}
  } catch (error) {
    logError('Fetch failed', error)
    return {success: false, error}
  }
}
```

### Multiple Return Branches

Blank lines between distinct conditional branches that each return.

```typescript
// GOOD - Blanks between return branches
async function handleUserType(user: User, context: Context) {
  if (user.status === UserStatus.Banned) {
    await logSecurityEvent('banned_user_attempt', user.id)
    return buildApiResponse(context, 403, {error: 'Account suspended'})
  }

  if (user.status === UserStatus.Anonymous) {
    const demoContent = getDemoContent()
    return buildApiResponse(context, 200, {contents: demoContent})
  }

  if (user.status === UserStatus.Pending) {
    return buildApiResponse(context, 403, {error: 'Email not verified'})
  }

  const content = await getUserContent(user.id)
  return buildApiResponse(context, 200, {contents: content})
}

// BAD - No separation between branches
async function handleUserType(user: User, context: Context) {
  if (user.status === UserStatus.Banned) {
    await logSecurityEvent('banned_user_attempt', user.id)
    return buildApiResponse(context, 403, {error: 'Account suspended'})
  }
  if (user.status === UserStatus.Anonymous) {
    const demoContent = getDemoContent()
    return buildApiResponse(context, 200, {contents: demoContent})
  }
  if (user.status === UserStatus.Pending) {
    return buildApiResponse(context, 403, {error: 'Email not verified'})
  }
  const content = await getUserContent(user.id)
  return buildApiResponse(context, 200, {contents: content})
}
```

### Log-Operation-Log Pattern

No blanks in the standard debug logging pattern.

```typescript
// GOOD - Compact log pattern
async function queryEntity(params: QueryParams) {
  logDebug('Entity.query <=', params)
  const response = await Entity.query.byIndex(params).go()
  logDebug('Entity.query =>', response)
  return response.data
}

// BAD - Spacing breaks visual connection
async function queryEntity(params: QueryParams) {
  logDebug('Entity.query <=', params)

  const response = await Entity.query.byIndex(params).go()

  logDebug('Entity.query =>', response)
  return response.data
}
```

---

## Return Statement Spacing

### Simple Return (No Blank)

```typescript
// GOOD - No blank for simple returns
function getValue(): string {
  const value = computeValue()
  return value
}
```

### Complex Setup Before Return (With Blank)

```typescript
// GOOD - Blank before return after complex construction
function buildResponse(data: Data, context: Context) {
  const transformed = transformData(data)
  const enriched = enrichWithMetadata(transformed)
  const validated = validateOutput(enriched)

  return {
    statusCode: 200,
    body: JSON.stringify(validated),
    headers: buildHeaders(context)
  }
}
```

---

## Real-World Examples

### From StartFileUpload Lambda

```typescript
// GOOD - fetchVideoInfoTraced follows pattern
async function fetchVideoInfoTraced(fileUrl: string, fileId: string): Promise<FetchVideoInfoResult> {
  const span = startSpan('yt-dlp-fetch-info')

  const result = await fetchVideoInfo(fileUrl)

  addAnnotation(span, 'videoId', fileId)
  addMetadata(span, 'videoUrl', fileUrl)
  addMetadata(span, 'success', result.success)
  endSpan(span)

  return result
}
```

Note the structure:
1. Setup (span creation) - then blank
2. Main operation - then blank
3. Cleanup sequence (annotations, metadata, end) - compact
4. Return

### From ListFiles Lambda

```typescript
// GOOD - getFilesByUser follows pattern
async function getFilesByUser(userId: string): Promise<File[]> {
  logDebug('getFilesByUser <=', userId)
  const userFilesResponse = await UserFiles.query.byUser({userId}).go()
  logDebug('getFilesByUser.userFiles =>', userFilesResponse)

  if (!userFilesResponse || !userFilesResponse.data || userFilesResponse.data.length === 0) {
    return []
  }

  const fileKeys = userFilesResponse.data.map((userFile) => ({fileId: userFile.fileId}))
  const {data: files, unprocessed} = await retryUnprocessed(() => Files.get(fileKeys).go({concurrency: 5}))
  logDebug('getFilesByUser.files =>', files)

  if (unprocessed.length > 0) {
    logError('getFilesByUser: failed to fetch all items after retries', unprocessed)
  }

  return files as File[]
}
```

Note the structure:
1. Query operation with debug logs - compact
2. Blank before guard clause
3. Blank before batch operation phase
4. Error check followed immediately by return

---

## Enforcement

### ESLint Rules (Warnings)

Custom ESLint rule `spacing-conventions` checks:
- Warn on blank lines in functions with <= 3 statements
- Warn on blank line between log and its associated operation
- Warn on blank line after simple guard clause

### Code Review Checklist

- [ ] No excessive blank lines in simple functions
- [ ] Blank lines only at logical phase boundaries
- [ ] Debug log patterns are compact
- [ ] Guard clauses are compact unless followed by complex logic
- [ ] Comments have preceding blank lines

---

## Related Patterns

- [Code Comments](Code-Comments.md) - Comment placement rules
- [Code Formatting](Code-Formatting.md) - dprint auto-formatting
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Handler structure

---

*Remember: Spacing creates visual hierarchy. Use it intentionally to show logical structure, not as filler between every statement.*
