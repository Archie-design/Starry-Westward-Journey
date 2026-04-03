-- PeakTrials: 巔峰試煉 event management
CREATE TABLE IF NOT EXISTS "PeakTrials" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    max_participants INT,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PeakTrialRegistrations: sign-ups per event
CREATE TABLE IF NOT EXISTS "PeakTrialRegistrations" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    trial_id uuid NOT NULL REFERENCES "PeakTrials"(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES "CharacterStats"("UserID") ON DELETE CASCADE,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trial_id, user_id)
);

-- PeakTrialReviews: admin review of each registration (photo/video evidence)
CREATE TABLE IF NOT EXISTS "PeakTrialReviews" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    registration_id uuid NOT NULL REFERENCES "PeakTrialRegistrations"(id) ON DELETE CASCADE,
    photo_urls TEXT[],
    video_url TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_peak_trial_regs_trial ON "PeakTrialRegistrations" (trial_id);
CREATE INDEX IF NOT EXISTS idx_peak_trial_regs_user ON "PeakTrialRegistrations" (user_id);
CREATE INDEX IF NOT EXISTS idx_peak_trial_reviews_reg ON "PeakTrialReviews" (registration_id);
