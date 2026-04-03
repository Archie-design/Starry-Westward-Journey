-- Extend PeakTrials with player-facing display fields
ALTER TABLE "PeakTrials"
    ADD COLUMN IF NOT EXISTS "date"           TEXT,
    ADD COLUMN IF NOT EXISTS "time"           TEXT,
    ADD COLUMN IF NOT EXISTS "location"       TEXT,
    ADD COLUMN IF NOT EXISTS "battalion_name" TEXT;

-- Extend PeakTrialRegistrations with attendance + user info
ALTER TABLE "PeakTrialRegistrations"
    ADD COLUMN IF NOT EXISTS "attended"       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "battalion_name" TEXT,
    ADD COLUMN IF NOT EXISTS "user_name"      TEXT,
    ADD COLUMN IF NOT EXISTS "squad_name"     TEXT;

-- View: PeakTrials with live registration count
CREATE OR REPLACE VIEW "PeakTrialsWithCount" AS
    SELECT p.*, COUNT(r.id)::int AS registration_count
    FROM "PeakTrials" p
    LEFT JOIN "PeakTrialRegistrations" r ON r.trial_id = p.id
    GROUP BY p.id;
