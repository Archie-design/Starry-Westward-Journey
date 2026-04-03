-- 加分副本管理：關鍵字觸發骰子獎勵規則表
CREATE TABLE IF NOT EXISTS "BonusQuestRules" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    keywords TEXT[] NOT NULL,
    "bonusType" TEXT NOT NULL CHECK ("bonusType" IN ('energy', 'golden')),
    "bonusAmount" INTEGER NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "BonusQuestRules" ENABLE ROW LEVEL SECURITY;

-- Allow read for all authenticated users
CREATE POLICY "BonusQuestRules read" ON "BonusQuestRules"
    FOR SELECT USING (true);

-- Allow write for service role only (admin server actions use service key)
CREATE POLICY "BonusQuestRules write" ON "BonusQuestRules"
    FOR ALL USING (auth.role() = 'service_role');
