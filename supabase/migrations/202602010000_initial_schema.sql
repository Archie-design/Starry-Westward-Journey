-- Initial schema: only core tables that other migrations depend on
-- All other tables are created by specialized migrations

-- CharacterStats (main player stats)
CREATE TABLE IF NOT EXISTS "CharacterStats" (
  "UserID" TEXT PRIMARY KEY,
  "Name" TEXT NOT NULL,
  "Role" TEXT,
  "Level" INTEGER DEFAULT 1,
  "Exp" INTEGER DEFAULT 0,
  "Coins" INTEGER DEFAULT 0,
  "GameGold" INTEGER DEFAULT 0,
  "EnergyDice" INTEGER DEFAULT 0,
  "GoldenDice" INTEGER DEFAULT 0,
  "Spirit" INTEGER DEFAULT 0,
  "Physique" INTEGER DEFAULT 0,
  "Charisma" INTEGER DEFAULT 0,
  "Savvy" INTEGER DEFAULT 0,
  "Luck" INTEGER DEFAULT 0,
  "Potential" INTEGER DEFAULT 0,
  "Streak" INTEGER DEFAULT 0,
  "LastCheckIn" TEXT,
  "TotalFines" INTEGER DEFAULT 0,
  "FinePaid" INTEGER DEFAULT 0,
  "CurrentQ" INTEGER DEFAULT 0,
  "CurrentR" INTEGER DEFAULT 0,
  "Email" TEXT UNIQUE,
  "SquadName" TEXT,
  "TeamName" TEXT,
  "IsCaptain" BOOLEAN DEFAULT FALSE,
  "IsCommandant" BOOLEAN DEFAULT FALSE,
  "IsGM" BOOLEAN DEFAULT FALSE,
  "Inventory" JSONB DEFAULT '[]',
  "GameInventory" JSONB DEFAULT '[]',
  "InitialFortunes" JSONB,
  "DDA_Difficulty" TEXT,
  "HP" INTEGER DEFAULT 100,
  "MaxHP" INTEGER DEFAULT 100,
  "Facing" INTEGER DEFAULT 0,
  "Birthday" TEXT,
  "LineUserId" TEXT UNIQUE,
  "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- DailyLogs (check-in records)
CREATE TABLE IF NOT EXISTS "DailyLogs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "Timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
  "UserID" TEXT NOT NULL REFERENCES "CharacterStats"("UserID") ON DELETE CASCADE,
  "QuestID" TEXT NOT NULL,
  "QuestTitle" TEXT NOT NULL,
  "RewardPoints" INTEGER DEFAULT 0,
  "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TeamSettings (squad/team info)
CREATE TABLE IF NOT EXISTS "TeamSettings" (
  "team_name" TEXT PRIMARY KEY,
  "team_coins" INTEGER DEFAULT 0,
  "mandatory_quest_id" TEXT,
  "mandatory_quest_week" TEXT,
  "quest_draw_history" JSONB DEFAULT '[]',
  "inventory" JSONB DEFAULT '[]',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- DailyLogs indexes for performance
CREATE INDEX IF NOT EXISTS "idx_dailylogs_userid_date" ON "DailyLogs"("UserID", "Timestamp");
CREATE INDEX IF NOT EXISTS "idx_dailylogs_questid" ON "DailyLogs"("QuestID");

-- SystemSettings (global settings)
CREATE TABLE IF NOT EXISTS "SystemSettings" (
  "SettingName" TEXT PRIMARY KEY,
  "Value" JSONB,
  "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
