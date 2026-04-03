-- 效能改善：添加缺少的 Index（解決資料庫連線超時問題）

-- DailyLogs 高頻查詢索引（每次打卡、每次 snapshot 都掃此表）
CREATE INDEX IF NOT EXISTS idx_dailylogs_userid ON "DailyLogs" ("UserID");
CREATE INDEX IF NOT EXISTS idx_dailylogs_timestamp ON "DailyLogs" ("Timestamp");
CREATE INDEX IF NOT EXISTS idx_dailylogs_userid_timestamp ON "DailyLogs" ("UserID", "Timestamp" DESC);

-- CharacterStats 缺少的索引（roster import 、retroactive achievement check）
CREATE INDEX IF NOT EXISTS idx_characterstats_email ON "CharacterStats" ("Email");
CREATE INDEX IF NOT EXISTS idx_characterstats_teamname ON "CharacterStats" ("TeamName");

-- MapEntities 座標快速查詢（weekly snapshot 用 SELECT q, r FROM MapEntities）
CREATE INDEX IF NOT EXISTS idx_mapentities_qr ON "MapEntities" (q, r);
