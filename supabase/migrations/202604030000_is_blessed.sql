-- Add IsBlessed flag to CharacterStats for golden dice chest blessing mechanic
ALTER TABLE "CharacterStats" ADD COLUMN IF NOT EXISTS "IsBlessed" BOOLEAN NOT NULL DEFAULT FALSE;
