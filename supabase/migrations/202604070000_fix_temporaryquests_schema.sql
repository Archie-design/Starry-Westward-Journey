-- Fix temporaryquests table: add missing columns that the UI expects
ALTER TABLE "temporaryquests"
  ADD COLUMN IF NOT EXISTS "quest_id" TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "sub" TEXT,
  ADD COLUMN IF NOT EXISTS "desc" TEXT,
  ADD COLUMN IF NOT EXISTS "limit_count" INTEGER DEFAULT 1;
