-- ============================================================
-- Fix 1: a4 幌金繩 correct prefix (t% not w2%)
-- Fix 2: bd_yuanmeng weekly 3-count server enforcement
-- Fix 3: temp_* one-per-player duplicate prevention
-- ============================================================

CREATE OR REPLACE FUNCTION process_checkin(
    p_user_id       TEXT,
    p_quest_id      TEXT,
    p_quest_title   TEXT,
    p_quest_reward  INTEGER,
    p_quest_dice    INTEGER DEFAULT 0,
    p_logical_today TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user             RECORD;
    v_team             RECORD;
    v_logical_today    TEXT;

    -- Reward cap
    v_daily_count      INTEGER;
    v_dup_count        INTEGER;
    v_week_count       INTEGER;
    v_reward_capped    BOOLEAN := FALSE;

    -- Inventories / buffs
    v_my_inventory     JSONB;
    v_team_inventory   JSONB    := '[]'::JSONB;
    v_d7_buff_active   BOOLEAN  := FALSE;

    -- Exp multiplier & rewards
    v_base_reward      INTEGER;
    v_exp_multiplier   NUMERIC(10,4) := 1.0;
    v_final_reward     INTEGER;

    -- Role cure
    v_is_cure          BOOLEAN := FALSE;
    v_cure_stat        TEXT;
    v_final_title      TEXT;

    -- Exp / level / coins
    v_current_exp      INTEGER;
    v_current_level    INTEGER;
    v_new_exp          INTEGER;
    v_new_level        INTEGER;
    v_level_delta      INTEGER;
    v_gained_coins     INTEGER;

    -- Dice
    v_bonus_dice       INTEGER := 0;
    v_golden_dice_gain INTEGER := 0;
    v_dice_gain        INTEGER;

    -- Stat gains (level-up growth + cure bonus)
    v_spirit_gain      INTEGER := 0;
    v_physique_gain    INTEGER := 0;
    v_charisma_gain    INTEGER := 0;
    v_savvy_gain       INTEGER := 0;
    v_luck_gain        INTEGER := 0;
    v_potential_gain   INTEGER := 0;

    v_updated          RECORD;
BEGIN
    -- ── 1. Lock user row ──────────────────────────────────────
    SELECT * INTO v_user
    FROM "CharacterStats"
    WHERE "UserID" = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', '查無此用戶: ' || p_user_id);
    END IF;

    -- ── 2. Logical today (Taiwan timezone, before noon = prev day) ─
    IF p_logical_today IS NOT NULL THEN
        v_logical_today := p_logical_today;
    ELSE
        v_logical_today := CASE
            WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Taipei') >= 12
            THEN TO_CHAR((NOW() AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD')
            ELSE TO_CHAR((NOW() AT TIME ZONE 'Asia/Taipei')::DATE - 1, 'YYYY-MM-DD')
        END;
    END IF;

    -- ── 3. Reward cap: first 3 q-quests per logical day only ──
    IF p_quest_id LIKE 'q%' THEN
        SELECT COUNT(*) INTO v_daily_count
        FROM "DailyLogs"
        WHERE "UserID" = p_user_id
          AND "QuestID" LIKE 'q%'
          AND CASE
                WHEN EXTRACT(HOUR FROM "Timestamp" AT TIME ZONE 'Asia/Taipei') >= 12
                THEN TO_CHAR(("Timestamp" AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD')
                ELSE TO_CHAR(("Timestamp" AT TIME ZONE 'Asia/Taipei')::DATE - 1, 'YYYY-MM-DD')
              END = v_logical_today;
        v_reward_capped := v_daily_count >= 3;
    END IF;

    -- ── 4. Duplicate prevention ────────────────────────────────
    -- q-quests: q1 ↔ q1_dawn mutually exclusive
    IF p_quest_id LIKE 'q%' THEN
        IF p_quest_id IN ('q1', 'q1_dawn') THEN
            SELECT COUNT(*) INTO v_dup_count
            FROM "DailyLogs"
            WHERE "UserID" = p_user_id
              AND "QuestID" IN ('q1', 'q1_dawn')
              AND CASE
                    WHEN EXTRACT(HOUR FROM "Timestamp" AT TIME ZONE 'Asia/Taipei') >= 12
                    THEN TO_CHAR(("Timestamp" AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD')
                    ELSE TO_CHAR(("Timestamp" AT TIME ZONE 'Asia/Taipei')::DATE - 1, 'YYYY-MM-DD')
                  END = v_logical_today;
        ELSE
            SELECT COUNT(*) INTO v_dup_count
            FROM "DailyLogs"
            WHERE "UserID" = p_user_id
              AND "QuestID" = p_quest_id
              AND CASE
                    WHEN EXTRACT(HOUR FROM "Timestamp" AT TIME ZONE 'Asia/Taipei') >= 12
                    THEN TO_CHAR(("Timestamp" AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM-DD')
                    ELSE TO_CHAR(("Timestamp" AT TIME ZONE 'Asia/Taipei')::DATE - 1, 'YYYY-MM-DD')
                  END = v_logical_today;
        END IF;

        IF v_dup_count > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', CASE p_quest_id
                    WHEN 'q1_dawn' THEN '今日已完成打拳，無法重複記錄。'
                    ELSE '此定課今日已完成。'
                END
            );
        END IF;
    END IF;

    -- Fix 2: bd_yuanmeng weekly limit (3 per ISO week) ─────────
    IF p_quest_id LIKE 'bd_yuanmeng%' THEN
        SELECT COUNT(*) INTO v_week_count
        FROM "DailyLogs"
        WHERE "UserID" = p_user_id
          AND "QuestID" LIKE 'bd_yuanmeng%'
          AND "Timestamp" >= DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Taipei') AT TIME ZONE 'Asia/Taipei';

        IF v_week_count >= 3 THEN
            RETURN jsonb_build_object('success', false, 'error', '本週親證圓夢計劃已達3次上限。');
        END IF;
    END IF;

    -- Fix 3: temp_* one-per-player duplicate prevention ─────────
    IF p_quest_id LIKE 'temp_%' THEN
        SELECT COUNT(*) INTO v_dup_count
        FROM "DailyLogs"
        WHERE "UserID" = p_user_id
          AND "QuestID" = p_quest_id;

        IF v_dup_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'error', '此臨時任務已完成，無法重複領取。');
        END IF;
    END IF;

    -- ── 5. Team settings (inventory + d7 buff) ────────────────
    IF v_user."TeamName" IS NOT NULL THEN
        SELECT * INTO v_team
        FROM "TeamSettings"
        WHERE "team_name" = v_user."TeamName";

        IF FOUND THEN
            v_team_inventory := COALESCE(v_team.inventory, '[]'::JSONB);
            IF v_team.d7_activated_at IS NOT NULL THEN
                v_d7_buff_active :=
                    EXTRACT(EPOCH FROM (NOW() - v_team.d7_activated_at)) < 48 * 3600;
            END IF;
        END IF;
    END IF;

    -- ── 6. Base reward & inventories ─────────────────────────
    v_base_reward  := CASE WHEN v_reward_capped THEN 0 ELSE p_quest_reward END;
    v_my_inventory := COALESCE(v_user."Inventory", '[]'::JSONB);

    -- ── 7. Exp multipliers ────────────────────────────────────
    -- a1: 如意金箍棒 ×1.2
    IF v_my_inventory ? 'a1' THEN
        v_exp_multiplier := v_exp_multiplier * 1.2;
    END IF;
    -- a5: 金剛杖 ×1.2 (exclusive with a1)
    IF (v_my_inventory ? 'a5') AND NOT (v_my_inventory ? 'a1') THEN
        v_exp_multiplier := v_exp_multiplier * 1.2;
    END IF;
    -- a3: 七彩袈裟 ×1.5 on q1/q1_dawn
    IF (v_team_inventory ? 'a3') AND p_quest_id IN ('q1', 'q1_dawn') THEN
        v_exp_multiplier := v_exp_multiplier * 1.5;
    END IF;
    -- Fix 1: a4 幌金繩 ×1.5 on t-prefix quests (體系活動), not w2
    IF (v_team_inventory ? 'a4') AND p_quest_id LIKE 't%' THEN
        v_exp_multiplier := v_exp_multiplier * 1.5;
    END IF;
    -- d7: 渾天至寶珠 ×2 during 48h team buff window
    IF v_d7_buff_active THEN
        v_exp_multiplier := v_exp_multiplier * 2.0;
    END IF;

    -- ── 8. Final reward ───────────────────────────────────────
    v_final_reward := CEIL(v_base_reward * v_exp_multiplier);
    -- a2: 照妖鏡 +150 on q1_dawn (applies even when reward capped)
    IF (v_my_inventory ? 'a2') AND p_quest_id = 'q1_dawn' THEN
        v_final_reward := v_final_reward + 150;
    END IF;

    -- ── 9. Role cure ──────────────────────────────────────────
    v_is_cure := CASE v_user."Role"
        WHEN '孫悟空' THEN p_quest_id = 'q2'
        WHEN '豬八戒' THEN p_quest_id = 'q6'
        WHEN '沙悟淨' THEN p_quest_id = 'q4'
        WHEN '白龍馬' THEN p_quest_id = 'q5'
        WHEN '唐三藏' THEN p_quest_id = 'q3'
        ELSE FALSE
    END;
    v_cure_stat := CASE v_user."Role"
        WHEN '孫悟空' THEN 'Spirit'
        WHEN '豬八戒' THEN 'Physique'
        WHEN '沙悟淨' THEN 'Savvy'
        WHEN '白龍馬' THEN 'Charisma'
        WHEN '唐三藏' THEN 'Potential'
        ELSE NULL
    END;
    v_final_title := CASE WHEN v_is_cure
        THEN p_quest_title || ' (天命對治)'
        ELSE p_quest_title
    END;

    -- ── 10. Exp / level / coins ───────────────────────────────
    v_current_exp   := COALESCE(v_user."Exp",   0);
    v_current_level := COALESCE(v_user."Level", 1);
    v_new_exp       := v_current_exp + v_final_reward;
    v_new_level     := calculate_level_from_exp(v_new_exp);
    v_level_delta   := v_new_level - v_current_level;
    -- Coins: 10% of BASE reward only (a2 +150 is exp-only, not coins)
    v_gained_coins  := FLOOR(v_base_reward::NUMERIC * 0.1);

    -- ── 11. Bonus dice from quest title keywords ──────────────
    IF p_quest_title LIKE '%小天使通話%'
       OR p_quest_title LIKE '%與家人互動%'
       OR p_quest_title LIKE '%親證圓夢%' THEN
        v_bonus_dice := v_bonus_dice + 1;
    END IF;
    IF p_quest_title LIKE '%心成%'
       OR p_quest_title LIKE '%同學會%'
       OR p_quest_title LIKE '%定聚%' THEN
        v_bonus_dice := v_bonus_dice + 2;
    END IF;
    IF p_quest_title LIKE '%傳愛%' THEN
        v_bonus_dice := v_bonus_dice + 1;
    END IF;
    IF p_quest_title LIKE '%主題親證%'
       OR p_quest_title LIKE '%會長交接%'
       OR p_quest_title LIKE '%大會%' THEN
        v_golden_dice_gain := v_golden_dice_gain + 1;
    END IF;
    v_dice_gain := p_quest_dice + v_bonus_dice;

    -- ── 12. Role stat growth per level gained ─────────────────
    IF v_level_delta > 0 THEN
        CASE v_user."Role"
            WHEN '孫悟空' THEN
                v_physique_gain  := 3 * v_level_delta;
                v_potential_gain := 2 * v_level_delta;
                v_charisma_gain  := 1 * v_level_delta;
                v_luck_gain      := 1 * v_level_delta;
                v_savvy_gain     := 1 * v_level_delta;
            WHEN '豬八戒' THEN
                v_luck_gain      := 4 * v_level_delta;
                v_charisma_gain  := 1 * v_level_delta;
                v_potential_gain := 1 * v_level_delta;
                v_spirit_gain    := 1 * v_level_delta;
                v_savvy_gain     := 1 * v_level_delta;
            WHEN '沙悟淨' THEN
                v_spirit_gain    := 2 * v_level_delta;
                v_physique_gain  := 2 * v_level_delta;
                v_charisma_gain  := 1 * v_level_delta;
                v_potential_gain := 2 * v_level_delta;
                v_luck_gain      := 1 * v_level_delta;
            WHEN '白龍馬' THEN
                v_charisma_gain  := 3 * v_level_delta;
                v_luck_gain      := 3 * v_level_delta;
                v_savvy_gain     := 1 * v_level_delta;
                v_spirit_gain    := 1 * v_level_delta;
            WHEN '唐三藏' THEN
                v_spirit_gain    := 4 * v_level_delta;
                v_potential_gain := 3 * v_level_delta;
                v_savvy_gain     := 1 * v_level_delta;
            ELSE NULL;
        END CASE;
    END IF;

    -- ── 13. Update CharacterStats ─────────────────────────────
    UPDATE "CharacterStats" SET
        "Exp"        = v_new_exp,
        "Level"      = v_new_level,
        "Coins"      = COALESCE("Coins",      0) + v_gained_coins,
        "EnergyDice" = COALESCE("EnergyDice", 0) + v_dice_gain,
        "GoldenDice" = COALESCE("GoldenDice", 0) + v_golden_dice_gain,
        "LastCheckIn"= v_logical_today,
        "Spirit"   = "Spirit"   + v_spirit_gain
            + CASE WHEN v_is_cure AND v_cure_stat = 'Spirit'   AND NOT v_reward_capped THEN 2 ELSE 0 END,
        "Physique" = "Physique" + v_physique_gain
            + CASE WHEN v_is_cure AND v_cure_stat = 'Physique' AND NOT v_reward_capped THEN 2 ELSE 0 END,
        "Charisma" = "Charisma" + v_charisma_gain
            + CASE WHEN v_is_cure AND v_cure_stat = 'Charisma' AND NOT v_reward_capped THEN 2 ELSE 0 END,
        "Savvy"    = "Savvy"    + v_savvy_gain
            + CASE WHEN v_is_cure AND v_cure_stat = 'Savvy'    AND NOT v_reward_capped THEN 2 ELSE 0 END,
        "Luck"     = "Luck"     + v_luck_gain
            + CASE WHEN v_is_cure AND v_cure_stat = 'Luck'     AND NOT v_reward_capped THEN 2 ELSE 0 END,
        "Potential"= "Potential"+ v_potential_gain
            + CASE WHEN v_is_cure AND v_cure_stat = 'Potential' AND NOT v_reward_capped THEN 2 ELSE 0 END
    WHERE "UserID" = p_user_id
    RETURNING * INTO v_updated;

    -- ── 14. Insert DailyLog ───────────────────────────────────
    INSERT INTO "DailyLogs" ("Timestamp", "UserID", "QuestID", "QuestTitle", "RewardPoints")
    VALUES (NOW(), p_user_id, p_quest_id, v_final_title, v_final_reward);

    RETURN jsonb_build_object(
        'success',      TRUE,
        'rewardCapped', v_reward_capped,
        'user',         row_to_json(v_updated)::JSONB
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
