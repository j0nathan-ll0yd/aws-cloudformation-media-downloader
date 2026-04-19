CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT DEFAULT NULL,
  image TEXT DEFAULT NULL,
  first_name TEXT DEFAULT NULL,
  last_name TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT DEFAULT NULL,
  refresh_token TEXT DEFAULT NULL,
  access_token_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  refresh_token_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  scope TEXT DEFAULT NULL,
  id_token TEXT DEFAULT NULL,
  password TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS files (
  file_id TEXT PRIMARY KEY,
  size INTEGER NOT NULL DEFAULT 0,
  author_name TEXT NOT NULL,
  author_user TEXT NOT NULL,
  publish_date TEXT NOT NULL,
  description TEXT NOT NULL,
  key TEXT NOT NULL,
  url TEXT DEFAULT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Queued',
  duration INTEGER DEFAULT NULL,
  upload_date TEXT DEFAULT NULL,
  view_count INTEGER DEFAULT NULL,
  thumbnail_url TEXT DEFAULT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS file_downloads (
  file_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  retry_after TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  error_category TEXT DEFAULT NULL,
  last_error TEXT DEFAULT NULL,
  scheduled_release_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  source_url TEXT DEFAULT NULL,
  correlation_id TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  system_version TEXT NOT NULL,
  system_name TEXT NOT NULL,
  endpoint_arn TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS user_files (
  user_id UUID NOT NULL,
  file_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, file_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS user_devices (
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, device_id)
);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS users_email_idx ON users(email);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS files_key_idx ON files(key);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS file_downloads_status_idx ON file_downloads(status, retry_after);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS sessions_user_idx ON sessions(user_id);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS sessions_token_idx ON sessions(token);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS accounts_user_idx ON accounts(user_id);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS accounts_provider_idx ON accounts(provider_id, account_id);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS verification_identifier_idx ON verification(identifier);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS user_files_user_idx ON user_files(user_id);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS user_files_file_idx ON user_files(file_id);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS user_devices_user_idx ON user_devices(user_id);
--> statement-breakpoint
CREATE INDEX ASYNC IF NOT EXISTS user_devices_device_idx ON user_devices(device_id);
