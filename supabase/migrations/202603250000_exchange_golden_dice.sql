-- 設定能源骰子上限為 100
INSERT INTO "SystemSettings" ("SettingName", "Value")
VALUES ('EnergyDiceCap', '100')
ON CONFLICT ("SettingName") DO UPDATE SET "Value" = '100';

-- 兌換函式：消耗 1 黃金骰子，獲得 3 能源骰子（上限 100）
CREATE OR REPLACE FUNCTION exchange_golden_to_energy_dice(p_user_id TEXT)
RETURNS void AS $$
DECLARE
    cap_val INT := 100;
BEGIN
    UPDATE "CharacterStats"
    SET "GoldenDice" = "GoldenDice" - 1,
        "EnergyDice" = LEAST("EnergyDice" + 3, cap_val)
    WHERE "UserID" = p_user_id AND "GoldenDice" >= 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient Golden Dice';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
