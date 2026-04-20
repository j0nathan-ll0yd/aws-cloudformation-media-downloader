ALTER TABLE files ADD COLUMN IF NOT EXISTS file_size BIGINT;
--> statement-breakpoint
UPDATE files SET file_size = size WHERE file_size IS NULL;
