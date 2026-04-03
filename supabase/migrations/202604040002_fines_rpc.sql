-- ============================================================
-- record_fine_payment: atomic fine payment recording
-- ============================================================
CREATE OR REPLACE FUNCTION record_fine_payment(
    p_captain_id          TEXT,
    p_target_id           TEXT,
    p_amount              INTEGER,
    p_period_label        TEXT,
    p_paid_to_captain_at  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_captain   RECORD;
    v_target    RECORD;
    v_balance   INTEGER;
    v_payment_id UUID;
BEGIN
    -- 1. Verify captain
    SELECT "TeamName", "IsCaptain" INTO v_captain
    FROM "CharacterStats" WHERE "UserID" = p_captain_id;

    IF NOT FOUND OR NOT v_captain."IsCaptain" THEN
        RETURN jsonb_build_object('success', false, 'error', '僅限小隊長使用此功能');
    END IF;

    -- 2. Verify target is in same squad (lock row)
    SELECT "Name", "TotalFines", COALESCE("FinePaid", 0) AS "FinePaid", "TeamName"
    INTO v_target
    FROM "CharacterStats"
    WHERE "UserID" = p_target_id
    FOR UPDATE;

    IF NOT FOUND OR v_target."TeamName" != v_captain."TeamName" THEN
        RETURN jsonb_build_object('success', false, 'error', '目標隊員不在同一小隊');
    END IF;

    -- 3. Check balance
    v_balance := GREATEST(0, v_target."TotalFines" - v_target."FinePaid");
    IF p_amount > v_balance THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '繳款金額 NT$' || p_amount || ' 超過餘額 NT$' || v_balance
        );
    END IF;

    -- 4. Update FinePaid
    UPDATE "CharacterStats"
    SET "FinePaid" = COALESCE("FinePaid", 0) + p_amount
    WHERE "UserID" = p_target_id;

    -- 5. Insert FinePayments record
    INSERT INTO "FinePayments"
        (user_id, user_name, squad_name, amount, period_label, paid_to_captain_at, recorded_by)
    VALUES
        (p_target_id, v_target."Name", v_captain."TeamName", p_amount,
         p_period_label, p_paid_to_captain_at::DATE, p_captain_id)
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object('success', true, 'paymentId', v_payment_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- check_squad_w3_compliance: idempotent weekly w3 fine check
-- Week range is calculated in JS and passed in as ISO strings.
-- ============================================================
CREATE OR REPLACE FUNCTION check_squad_w3_compliance(
    p_captain_id   TEXT,
    p_week_start   TIMESTAMPTZ,
    p_week_end     TIMESTAMPTZ,
    p_period_label TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_captain    RECORD;
    v_member     RECORD;
    v_completed  TEXT[];
    v_violators  JSONB := '[]'::JSONB;
    v_idempotent_key TEXT;
BEGIN
    -- 1. Verify captain
    SELECT "TeamName", "IsCaptain" INTO v_captain
    FROM "CharacterStats" WHERE "UserID" = p_captain_id;

    IF NOT FOUND OR NOT v_captain."IsCaptain" THEN
        RETURN jsonb_build_object('success', false, 'error', '僅限小隊長使用此功能');
    END IF;

    v_idempotent_key := p_period_label || '|' || v_captain."TeamName";

    -- 2. Idempotency: already run for this squad+period?
    IF EXISTS (
        SELECT 1 FROM "AdminActivityLog"
        WHERE action = 'w3_compliance' AND target_name = v_idempotent_key
        LIMIT 1
    ) THEN
        RETURN jsonb_build_object('success', true, 'alreadyRun', true, 'periodLabel', p_period_label);
    END IF;

    -- 3. Get members who completed w3 this week
    SELECT ARRAY(
        SELECT DISTINCT "UserID" FROM "DailyLogs"
        WHERE "QuestID" LIKE 'w3%'
          AND "Timestamp" >= p_week_start AND "Timestamp" < p_week_end
          AND "UserID" IN (
              SELECT "UserID" FROM "CharacterStats" WHERE "TeamName" = v_captain."TeamName"
          )
    ) INTO v_completed;

    -- 4. Fine violators
    FOR v_member IN
        SELECT "UserID", "Name" FROM "CharacterStats"
        WHERE "TeamName" = v_captain."TeamName"
    LOOP
        IF NOT (v_member."UserID" = ANY(v_completed)) THEN
            UPDATE "CharacterStats"
            SET "TotalFines" = "TotalFines" + 200
            WHERE "UserID" = v_member."UserID";

            v_violators := v_violators || jsonb_build_object(
                'userId', v_member."UserID",
                'name',   v_member."Name"
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success',     true,
        'alreadyRun',  false,
        'periodLabel', p_period_label,
        'teamName',    v_captain."TeamName",
        'violators',   v_violators
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION record_fine_payment(TEXT, TEXT, INTEGER, TEXT, TEXT)
    TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION check_squad_w3_compliance(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT)
    TO authenticated, anon, service_role;
