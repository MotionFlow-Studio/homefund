-- Orders every change for the sync cursor. Each write takes the next value.
CREATE SEQUENCE IF NOT EXISTS "sync_seq" AS bigint START 1;
