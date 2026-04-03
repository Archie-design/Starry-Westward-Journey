-- Additional tables required by other migrations

-- TopicHistory (topic quest history)
CREATE TABLE IF NOT EXISTS "TopicHistory" (
  "id" SERIAL PRIMARY KEY,
  "TopicTitle" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- temporaryquests (admin-created temporary quests)
CREATE TABLE IF NOT EXISTS "temporaryquests" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quest_id" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "reward" INTEGER DEFAULT 0,
  "dice" INTEGER DEFAULT 0,
  "active" BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "created_by" TEXT,
  "expires_at" TIMESTAMP WITH TIME ZONE
);

-- MandatoryQuestHistory (weekly mandatory quest draw history)
CREATE TABLE IF NOT EXISTS "MandatoryQuestHistory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_name" TEXT NOT NULL REFERENCES "TeamSettings"("team_name") ON DELETE CASCADE,
  "quest_id" TEXT NOT NULL,
  "week_start" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CourseRegistrations (course registration records)
CREATE TABLE IF NOT EXISTS "CourseRegistrations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "CharacterStats"("UserID") ON DELETE CASCADE,
  "course_key" TEXT NOT NULL,
  "registered_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CourseAttendance (course attendance records)
CREATE TABLE IF NOT EXISTS "CourseAttendance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "CharacterStats"("UserID") ON DELETE CASCADE,
  "course_key" TEXT NOT NULL,
  "attended_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- FinePayments (fine payment records)
CREATE TABLE IF NOT EXISTS "FinePayments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "CharacterStats"("UserID") ON DELETE CASCADE,
  "user_name" TEXT NOT NULL,
  "squad_name" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "period_label" TEXT NOT NULL,
  "paid_to_captain_at" DATE,
  "submitted_to_org_at" DATE,
  "recorded_by" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fine_payments_user_id ON "FinePayments" (user_id);
CREATE INDEX IF NOT EXISTS idx_fine_payments_squad_name ON "FinePayments" (squad_name);

-- SquadFineSubmissions (squad fine submission records)
CREATE TABLE IF NOT EXISTS "SquadFineSubmissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "squad_name" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "submitted_at" TEXT NOT NULL,
  "recorded_by" TEXT NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Achievements (player achievements)
CREATE TABLE IF NOT EXISTS "Achievements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "CharacterStats"("UserID") ON DELETE CASCADE,
  "achievement_id" TEXT NOT NULL,
  "unlocked_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON "Achievements"(user_id);

-- Testimonies (LINE bot testimony records)
CREATE TABLE IF NOT EXISTS "Testimonies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "line_group_id" TEXT,
  "line_user_id" TEXT NOT NULL,
  "display_name" TEXT,
  "parsed_name" TEXT,
  "parsed_date" TEXT,
  "parsed_category" TEXT,
  "content" TEXT NOT NULL,
  "raw_message" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testimonies_line_user_id ON "Testimonies"(line_user_id);

-- LineGroups (LINE group associations)
CREATE TABLE IF NOT EXISTS "LineGroups" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" TEXT NOT NULL UNIQUE,
  "group_name" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
