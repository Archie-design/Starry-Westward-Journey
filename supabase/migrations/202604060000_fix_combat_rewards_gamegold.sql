-- K2 Fix: add_combat_rewards must update GameGold (combat currency), not Coins (quest currency).
-- Also adds p_team_name + p_team_bonus to atomically update team_coins in the same call,
-- replacing the broken supabase.rpc('increment') pattern in combat.ts.

-- Drop old 6-param version (signature change requires DROP + CREATE)
DROP FUNCTION IF EXISTS add_combat_rewards(text, integer, integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION add_combat_rewards(
    p_user_id     text,
    p_exp         integer,
    p_coins       integer,       -- quest Coins (unused from combat, kept for backward compat)
    p_dice        integer,
    p_golden_dice integer,
    p_new_hp      integer,
    p_game_gold   integer DEFAULT 0,   -- combat currency → CharacterStats.GameGold
    p_team_name   text    DEFAULT NULL, -- if set, add p_team_bonus to TeamSettings.team_coins
    p_team_bonus  integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE "CharacterStats"
    SET
        "Exp"        = COALESCE("Exp", 0)        + p_exp,
        "Coins"      = COALESCE("Coins", 0)      + p_coins,
        "GameGold"   = COALESCE("GameGold", 0)   + p_game_gold,
        "EnergyDice" = COALESCE("EnergyDice", 0) + p_dice,
        "GoldenDice" = COALESCE("GoldenDice", 0) + p_golden_dice,
        "HP"         = p_new_hp
    WHERE "UserID" = p_user_id;

    -- Atomic team bonus (avoids read-then-write race condition)
    IF p_team_name IS NOT NULL AND p_team_bonus > 0 THEN
        UPDATE "TeamSettings"
        SET "team_coins" = COALESCE("team_coins", 0) + p_team_bonus
        WHERE "team_name" = p_team_name;
    END IF;
END;
$$;
