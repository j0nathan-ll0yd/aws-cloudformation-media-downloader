-- Create PostgreSQL roles for three-tier access model
-- See: https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues/196
--
-- Access tiers:
-- - app_readonly: SELECT only (ListFiles, S3ObjectCreated)
-- - app_readwrite: Full DML (most Lambdas)
-- - admin: Built-in, used by MigrateDSQL only
--
-- NOTE: DROP OWNED BY and DROP ROLE are NOT supported in Aurora DSQL
-- CREATE ROLE errors are ignored if role exists (PostgreSQL error 42710)
-- GRANT statements are idempotent

-- Create the readonly role with LOGIN (required for IAM auth)
CREATE ROLE app_readonly WITH LOGIN;

-- Create the readwrite role with LOGIN (required for IAM auth)
CREATE ROLE app_readwrite WITH LOGIN;

-- NOTE: GRANT USAGE ON SCHEMA public is NOT supported in Aurora DSQL
-- The public schema has implicit usage for roles with LOGIN capability
-- See: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-unsupported-features.html

-- ReadOnly: SELECT only on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;

-- ReadWrite: Full DML on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_readwrite;

-- NOTE: ALTER DEFAULT PRIVILEGES is NOT supported in Aurora DSQL for public schema
-- Future migrations that add tables must include explicit GRANT statements
-- See: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-unsupported-features.html
