-- d3 心魔殘骸：本賽季心魔怪掉落率永久加成（每消耗一個 +0.05）
ALTER TABLE "CharacterStats"
  ADD COLUMN IF NOT EXISTS "DemonDropBoostSeasonal" NUMERIC NOT NULL DEFAULT 0;

-- d7 渾天至寶珠：全隊梵天庇護啟動時間戳（NULL = 未啟用）
ALTER TABLE "TeamSettings"
  ADD COLUMN IF NOT EXISTS "d7_activated_at" TIMESTAMPTZ;
