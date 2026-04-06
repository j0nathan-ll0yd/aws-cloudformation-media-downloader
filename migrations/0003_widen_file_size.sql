-- Widen files.size from integer (max ~2GB) to bigint (max ~9.2 exabytes)
-- Aurora DSQL does not support ALTER COLUMN TYPE, DROP COLUMN, SET DEFAULT, or SET NOT NULL.
-- Strategy: add nullable bigint column and backfill from old column.
-- Drizzle schema maps property 'size' to column 'file_size' with app-level default(0) and notNull().
-- The old 'size' integer column remains but is unused.
ALTER TABLE files ADD COLUMN IF NOT EXISTS file_size BIGINT;
UPDATE files SET file_size = size WHERE file_size IS NULL;
