# Implementation Plan: GitHub Issue #151 - Rich File Metadata

## Executive Summary

This plan adds four new metadata fields to the Files entity: `duration`, `uploadDate`, `viewCount`, and `thumbnailUrl`. These fields will be extracted from yt-dlp's JSON output during video download and exposed via the ListFiles API.

## New Fields

| Field | Type | Description |
|-------|------|-------------|
| duration | number | Video length in seconds |
| uploadDate | string | Original YouTube upload date (ISO 8601) |
| viewCount | number | View count at download time |
| thumbnailUrl | string | YouTube thumbnail image URL |

## Current Architecture

**Data Flow:**
1. `StartFileUpload` Lambda receives download request from SQS
2. Calls `fetchVideoInfo(fileUrl)` which executes yt-dlp `--dump-json`
3. Returns `YtDlpVideoInfo` object with video metadata
4. Constructs `File` domain object and calls `upsertFile()`
5. File record persisted to Aurora DSQL
6. `ListFiles` Lambda queries files via `getFilesForUser()` and returns via API

---

## Phase 1: Update Drizzle Schema

**File:** `src/lib/vendor/Drizzle/schema.ts`

Add 4 new columns to the `files` table:

```typescript
export const files = pgTable('files', {
  // ... existing fields ...

  // New fields for issue #151
  /** Video duration in seconds */
  duration: integer('duration'),
  /** Original YouTube upload date (ISO 8601) */
  uploadDate: text('upload_date'),
  /** View count at download time */
  viewCount: integer('view_count'),
  /** YouTube thumbnail URL */
  thumbnailUrl: text('thumbnail_url')
})
```

---

## Phase 2: Database Migration

**New File:** `migrations/0003_rich_metadata.sql`

```sql
-- Migration: 0003_rich_metadata
-- Description: Add rich metadata fields for video duration, upload date, view count, thumbnail
-- Issue: #151

ALTER TABLE files ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS upload_date TEXT DEFAULT NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT NULL;
```

---

## Phase 3: Update Domain Model Types

**File:** `src/types/domainModels.d.ts`

Extend the `File` interface:

```typescript
export interface File {
  // ... existing fields ...

  // New fields for issue #151
  /** Video duration in seconds */
  duration?: number
  /** Original YouTube upload date (ISO 8601) */
  uploadDate?: string
  /** View count at time of download */
  viewCount?: number
  /** YouTube thumbnail URL */
  thumbnailUrl?: string
}
```

---

## Phase 4: Update StartFileUpload Lambda

**File:** `src/lambdas/StartFileUpload/src/index.ts`

Update `fileData` construction in `processDownloadRequest`:

```typescript
const fileData: File = {
  // ... existing fields ...

  // New fields for issue #151
  duration: videoInfo.duration,
  uploadDate: videoInfo.upload_date,
  viewCount: videoInfo.view_count,
  thumbnailUrl: videoInfo.thumbnail
}
```

---

## Phase 5: Update FileQueries

**File:** `src/entities/queries/fileQueries.ts`

Update `upsertFile` method to include new fields in `onConflictDoUpdate`:

```typescript
set: {
  // ... existing fields ...

  // New fields for issue #151
  duration: input.duration,
  uploadDate: input.uploadDate,
  viewCount: input.viewCount,
  thumbnailUrl: input.thumbnailUrl
}
```

---

## Phase 6: Update TypeSpec API Models

**File:** `tsp/models/models.tsp`

Extend the `File` model:

```typespec
model File {
  // ... existing fields ...

  /** Video duration in seconds */
  duration?: int32;

  /** Original YouTube upload date (ISO 8601) */
  uploadDate?: string;

  /** View count at time of download */
  viewCount?: int64;

  /** YouTube thumbnail URL */
  thumbnailUrl?: url;
}
```

After updating, regenerate API schemas:
```bash
pnpm run generate:api-types
```

---

## Implementation Order

1. Update Drizzle schema
2. Create database migration
3. Update domain models
4. Update TypeSpec + regenerate API schemas
5. Update file queries
6. Update StartFileUpload Lambda
7. Update test fixtures

---

## Critical Files

| File | Purpose |
|------|---------|
| `src/lib/vendor/Drizzle/schema.ts` | Drizzle table definition - add 4 columns |
| `src/types/domainModels.d.ts` | Domain model interface |
| `src/lambdas/StartFileUpload/src/index.ts` | Extract and persist metadata |
| `tsp/models/models.tsp` | TypeSpec API model (source of truth) |
