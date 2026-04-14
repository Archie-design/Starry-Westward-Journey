-- Map achievement tracking columns for CharacterStats
-- Supports 40 map achievements across exploration, combat, chest, team, and role categories

ALTER TABLE "CharacterStats"
  -- Kill counters
  ADD COLUMN IF NOT EXISTS "TotalKills"        INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "EliteKills"        INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "DemonKills"        INT   NOT NULL DEFAULT 0,
  -- Chest counter
  ADD COLUMN IF NOT EXISTS "TotalChestsOpened" INT   NOT NULL DEFAULT 0,
  -- Zone exploration (array of zone IDs where at least 1 kill happened)
  ADD COLUMN IF NOT EXISTS "ZonesCleared"      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Movement counter
  ADD COLUMN IF NOT EXISTS "TotalHexesMoved"   INT   NOT NULL DEFAULT 0,
  -- Per-zone kill counts, e.g. {"pride": 5, "anger": 22}
  ADD COLUMN IF NOT EXISTS "ZoneKillCounts"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Mimic savvy check successes
  ADD COLUMN IF NOT EXISTS "MimicSuccesses"    INT   NOT NULL DEFAULT 0,
  -- Dice donated to teammates (累計贈予次數)
  ADD COLUMN IF NOT EXISTS "DonatedDice"       INT   NOT NULL DEFAULT 0,
  -- Wukong obsidian passages (孫悟空 金箍棒穿越黑曜石)
  ADD COLUMN IF NOT EXISTS "ObsidianPassages"  INT   NOT NULL DEFAULT 0,
  -- Wujing guardian wins (沙悟淨 相鄰隊友下的勝場)
  ADD COLUMN IF NOT EXISTS "GuardianWins"      INT   NOT NULL DEFAULT 0,
  -- Fog trap trigger date (for fog_survivor: logical date of last fog trap, e.g. "2026-04-14")
  ADD COLUMN IF NOT EXISTS "FogTrapDate"       TEXT,
  -- Dice received date (for lucky_heist: logical date of last dice received from teammate)
  ADD COLUMN IF NOT EXISTS "DiceReceivedDate"  TEXT,
  -- Daily kill tracking (for triple_kill_day)
  ADD COLUMN IF NOT EXISTS "DailyKillDate"     TEXT,
  ADD COLUMN IF NOT EXISTS "DailyKillCount"    INT   NOT NULL DEFAULT 0;
