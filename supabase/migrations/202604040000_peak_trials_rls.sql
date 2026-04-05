-- Enable RLS on PeakTrials tables
-- All writes go through server actions using service_role key (bypasses RLS).
-- These policies only govern direct client-side API access.

-- ============================================================
-- PeakTrials: anyone can read active trials, no direct writes
-- ============================================================
ALTER TABLE "PeakTrials" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PeakTrials_select_all"
    ON "PeakTrials"
    FOR SELECT
    USING (true);

-- ============================================================
-- PeakTrialRegistrations: anyone can read, no direct writes
-- ============================================================
ALTER TABLE "PeakTrialRegistrations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PeakTrialRegistrations_select_all"
    ON "PeakTrialRegistrations"
    FOR SELECT
    USING (true);

-- ============================================================
-- PeakTrialReviews: no direct access (admin-only via service role)
-- ============================================================
ALTER TABLE "PeakTrialReviews" ENABLE ROW LEVEL SECURITY;

-- No public policies — only service_role key can access this table.
