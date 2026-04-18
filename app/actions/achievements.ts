'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getLogicalDateStr } from '@/lib/utils/time';
import type { AchievementRecord } from '@/types';

// ─── Role → cureTaskId mapping (server-only, mirrors ROLE_CURE_MAP in constants) ───
const ROLE_CURE_TASK: Record<string, string> = {
    '孫悟空': 'q2',
    '豬八戒': 'q6',
    '沙悟淨': 'q4',
    '白龍馬': 'q5',
    '唐三藏': 'q3',
};

// ─── Private utility functions ────────────────────────────────────────────────

/** Convert an array of ISO timestamp strings to sorted, deduplicated logical date strings */
function toLogicalDates(timestamps: string[]): string[] {
    const set = new Set(timestamps.map(ts => getLogicalDateStr(ts)));
    return Array.from(set).sort();
}

/** How many consecutive days ending on targetDate exist in sortedDates? */
function getStreakEndingOn(sortedDates: string[], targetDate: string): number {
    if (!sortedDates.includes(targetDate)) return 0;
    let streak = 1;
    const cursor = new Date(targetDate);
    while (true) {
        cursor.setDate(cursor.getDate() - 1);
        const prev = cursor.toISOString().slice(0, 10);
        if (sortedDates.includes(prev)) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}

/**
 * Days between the last occurrence in sortedHistoryDates and todayStr.
 * Returns 0 if there's no prior history.
 * "History" should NOT include today's date.
 */
function getDaysSinceLast(sortedHistoryDates: string[], todayStr: string): number {
    if (sortedHistoryDates.length === 0) return 0;
    const last = sortedHistoryDates[sortedHistoryDates.length - 1];
    const msPerDay = 86400000;
    return Math.round((new Date(todayStr).getTime() - new Date(last).getTime()) / msPerDay);
}

// ─── Main exported functions ──────────────────────────────────────────────────

/**
 * After a successful quest check-in, evaluate all 43 achievement conditions
 * and insert newly-unlocked achievements. Returns the IDs of newly unlocked achievements.
 */
export async function checkAndUnlockAchievements(
    userId: string,
    _newQuestId: string,
): Promise<string[]> {
    const supabase = supabaseAdmin;
    try {
        // 1. Fetch user stats, all logs, and existing achievements in parallel via Supabase SDK
        const logsSince = new Date();
        logsSince.setDate(logsSince.getDate() - 90);

        const [userRes, logsRes, existingRes] = await Promise.all([
            supabase
                .from('CharacterStats')
                .select('Role,Spirit,Physique,Charisma,Savvy,Luck,Potential,TeamName')
                .eq('UserID', userId)
                .single(),
            supabase
                .from('DailyLogs')
                .select('QuestID,Timestamp')
                .eq('UserID', userId)
                .gte('Timestamp', logsSince.toISOString())
                .order('Timestamp', { ascending: true }),
            supabase
                .from('Achievements')
                .select('achievement_id')
                .eq('user_id', userId),
        ]);

        if (userRes.error || !userRes.data) return [];
        const user = userRes.data;
        const logs = (logsRes.data ?? []) as { QuestID: string; Timestamp: string }[];
        const alreadyUnlocked = new Set<string>(
            (existingRes.data ?? []).map((r: { achievement_id: string }) => r.achievement_id)
        );

        // ── Derive counts and date arrays ──────────────────────────────────
        const todayStr = getLogicalDateStr();

        const totalCount = logs.length;
        const q1Logs = logs.filter(l => l.QuestID === 'q1' || l.QuestID === 'q1_dawn');
        const dawnLogs = logs.filter(l => l.QuestID === 'q1_dawn');
        const q2Logs = logs.filter(l => l.QuestID === 'q2');
        const q3Logs = logs.filter(l => l.QuestID === 'q3');
        const q4Logs = logs.filter(l => l.QuestID === 'q4');
        const q5Logs = logs.filter(l => l.QuestID === 'q5');
        const q6Logs = logs.filter(l => l.QuestID === 'q6');
        const q7Logs = logs.filter(l => l.QuestID === 'q7');
        const w1Logs = logs.filter(l => l.QuestID.startsWith('w1'));
        const w4Logs = logs.filter(l => l.QuestID.startsWith('w4'));
        const tLogs  = logs.filter(l => l.QuestID.startsWith('t'));
        const bdLogs = logs.filter(l => l.QuestID.startsWith('bd_yuanmeng'));
        const tempLogs = logs.filter(l => l.QuestID.startsWith('temp_'));

        const cureTaskId = ROLE_CURE_TASK[user.Role] ?? '';
        const cureLogs = cureTaskId ? logs.filter(l => l.QuestID === cureTaskId) : [];

        const q1Count   = q1Logs.length;
        const dawnCount = dawnLogs.length;
        const q2Count   = q2Logs.length;
        const q3Count   = q3Logs.length;
        const q4Count   = q4Logs.length;
        const q5Count   = q5Logs.length;
        const q6Count   = q6Logs.length;
        const q7Count   = q7Logs.length;
        const w1Count   = w1Logs.length;
        const w4Count   = w4Logs.length;
        const tCount    = tLogs.length;
        const bdCount   = bdLogs.length;
        const tempCount = tempLogs.length;
        const cureCount = cureLogs.length;

        // Logical date arrays (sorted, deduped)
        const punchDates   = toLogicalDates(q1Logs.map(l => l.Timestamp));
        const dawnDates    = toLogicalDates(dawnLogs.map(l => l.Timestamp));
        const anyQDates    = toLogicalDates(logs.filter(l => l.QuestID.startsWith('q')).map(l => l.Timestamp));

        // Streaks ending on today
        const punchStreakToday = getStreakEndingOn(punchDates, todayStr);
        const anyStreakToday   = getStreakEndingOn(anyQDates, todayStr);
        const dawnStreakToday  = getStreakEndingOn(dawnDates, todayStr);

        // Today's q-prefix quest count (for full_day)
        const todayQCount = logs.filter(l => l.QuestID.startsWith('q') && getLogicalDateStr(l.Timestamp) === todayStr).length;

        // Gap calculations for comeback/phoenix/prodigal:
        function maxGapForType(typeLogs: { QuestID: string; Timestamp: string }[]): number {
            const histDates = toLogicalDates(typeLogs.map(l => l.Timestamp)).filter(d => d < todayStr);
            return getDaysSinceLast(histDates, todayStr);
        }

        const questTypeGroups: { QuestID: string; Timestamp: string }[][] = [
            q1Logs, q2Logs, q3Logs, q4Logs, q5Logs, q6Logs, q7Logs
        ].filter(g => g.length > 0);

        const todayQuestIds = new Set(logs
            .filter(l => getLogicalDateStr(l.Timestamp) === todayStr)
            .map(l => l.QuestID));

        let maxGap7 = 0, maxGap14 = 0, maxGap30 = 0;
        for (const group of questTypeGroups) {
            const qid = group[0].QuestID;
            if (!todayQuestIds.has(qid)) continue;
            const gap = maxGapForType(group);
            if (gap > maxGap7) maxGap7 = gap;
            if (gap > maxGap14) maxGap14 = gap;
            if (gap > maxGap30) maxGap30 = gap;
        }

        // all_daily: q1/q1_dawn + q2..q7 each at least once
        const allDaily = q1Count >= 1 && q2Count >= 1 && q3Count >= 1 &&
                         q4Count >= 1 && q5Count >= 1 && q6Count >= 1 && q7Count >= 1;

        // omnipractice: q1-q7, w1-w4, t, bd_yuanmeng each >= 1
        const hasW2 = logs.some(l => l.QuestID.startsWith('w2'));
        const hasW3 = logs.some(l => l.QuestID.startsWith('w3'));
        const omnipractice = allDaily && w1Count >= 1 && hasW2 && hasW3 && w4Count >= 1 && tCount >= 1 && bdCount >= 1;

        // ── Team achievement data (only if user has a team) ──────────────
        let teamMemberIds: string[] = [];
        const teammateLogsToday: Record<string, boolean> = {};
        const teammateAnyToday: Record<string, boolean> = {};
        const teammateRecentPunch: Record<string, string[]> = {};

        if (user.TeamName) {
            const since = new Date();
            since.setDate(since.getDate() - 10);

            // Step 1: get teammate IDs
            const membersRes = await supabase
                .from('CharacterStats')
                .select('UserID')
                .eq('TeamName', user.TeamName)
                .neq('UserID', userId);

            teamMemberIds = (membersRes.data ?? []).map((r: { UserID: string }) => r.UserID);

            if (teamMemberIds.length > 0) {
                // Step 2: fetch recent logs scoped to teammate IDs only
                const teammateLogsRes = await supabase
                    .from('DailyLogs')
                    .select('UserID,QuestID,Timestamp')
                    .in('UserID', teamMemberIds)
                    .gte('Timestamp', since.toISOString());

                const tLogs2 = (teammateLogsRes.data ?? []) as { UserID: string; QuestID: string; Timestamp: string }[];

                for (const tm of teamMemberIds) {
                    const tmLogs = tLogs2.filter(l => l.UserID === tm);
                    teammateLogsToday[tm] = tmLogs.some(l =>
                        (l.QuestID === 'q1' || l.QuestID === 'q1_dawn') &&
                        getLogicalDateStr(l.Timestamp) === todayStr
                    );
                    teammateAnyToday[tm] = tmLogs.some(l => getLogicalDateStr(l.Timestamp) === todayStr);
                    teammateRecentPunch[tm] = toLogicalDates(
                        tmLogs.filter(l => l.QuestID === 'q1' || l.QuestID === 'q1_dawn').map(l => l.Timestamp)
                    );
                }
            }
        }

        // team_punch: ≥ 2 people (self + at least 1 teammate) have q1/q1_dawn today
        const selfPunchToday = punchDates.includes(todayStr);
        const teamPunchCount = (selfPunchToday ? 1 : 0) +
            Object.values(teammateLogsToday).filter(Boolean).length;
        const teamPunch = user.TeamName && teamPunchCount >= 2;

        // team_perfect: all team members have at least 1 quest today
        const selfAnyToday = anyQDates.includes(todayStr);
        const allTeamAnyToday = selfAnyToday &&
            Object.values(teammateAnyToday).every(Boolean) &&
            teamMemberIds.length > 0;
        const teamPerfect = user.TeamName && allTeamAnyToday;

        // team_streak: any teammate has 3-day consecutive punch overlap with self
        let teamStreak = false;
        if (user.TeamName && selfPunchToday) {
            for (const tm of teamMemberIds) {
                const tmPunch = teammateRecentPunch[tm] ?? [];
                const d2 = new Date(todayStr); d2.setDate(d2.getDate() - 1);
                const d3 = new Date(todayStr); d3.setDate(d3.getDate() - 2);
                const day2 = d2.toISOString().slice(0, 10);
                const day3 = d3.toISOString().slice(0, 10);
                const selfHas = punchDates.includes(day2) && punchDates.includes(day3);
                const tmHas = tmPunch.includes(todayStr) && tmPunch.includes(day2) && tmPunch.includes(day3);
                if (selfHas && tmHas) { teamStreak = true; break; }
            }
        }

        // ── Build candidate set ────────────────────────────────────────────
        const candidates: string[] = [];
        const check = (id: string, cond: boolean) => {
            if (!alreadyUnlocked.has(id) && cond) candidates.push(id);
        };

        check('first_step',        totalCount >= 1);
        check('full_day',          todayQCount >= 3);
        check('streak_3',          punchStreakToday >= 3);
        check('dawn_boxer',        dawnCount >= 5);
        check('veg_pioneer',       q6Count >= 20);
        check('early_sleeper',     q7Count >= 20);
        check('weekly_caller',     w1Count >= 5);
        check('comeback',          maxGap7 >= 7);
        check('streak_7',          punchStreakToday >= 7);
        check('full_week',         anyStreakToday >= 5);
        check('dawn_devotee',      dawnCount >= 20);
        check('meditation_master', q2Count >= 30);
        check('dance_devotee',     q3Count >= 30);
        check('role_cure_10',      cureCount >= 10);
        check('w4_giver',          w4Count >= 10);
        check('topic_devotee',     tCount >= 5);
        check('yuanmeng',          bdCount >= 3);
        check('all_daily',         allDaily);
        check('temp_master',       tempCount >= 5);
        check('marathon',          totalCount >= 100);
        check('mastery_q1',        q1Count >= 50);
        check('phoenix',           maxGap14 >= 14);
        check('streak_30',         punchStreakToday >= 30);
        check('role_cure_50',      cureCount >= 50);
        check('five_hundred',      totalCount >= 500);
        check('dawn_legend',       dawnCount >= 50);
        check('full_month',        anyStreakToday >= 20);
        check('prodigal',          maxGap30 >= 30);
        check('omnipractice',      omnipractice);
        check('eternal_dawn',      dawnStreakToday >= 7);
        check('team_punch',        !!teamPunch);
        check('team_perfect',      !!teamPerfect);
        check('team_streak',       teamStreak);
        // Role-exclusive
        check('wukong_dawn',       user.Role === '孫悟空' && dawnCount >= 30);
        check('wukong_spirit',     user.Role === '孫悟空' && user.Spirit >= 20);
        check('bajie_veg',         user.Role === '豬八戒' && q6Count >= 30);
        check('bajie_physique',    user.Role === '豬八戒' && user.Physique >= 20);
        check('wujing_chant',      user.Role === '沙悟淨' && q4Count >= 30);
        check('wujing_savvy',      user.Role === '沙悟淨' && user.Savvy >= 20);
        check('horse_gratitude',   user.Role === '白龍馬' && q5Count >= 30);
        check('horse_charisma',    user.Role === '白龍馬' && user.Charisma >= 20);
        check('monk_dance',        user.Role === '唐三藏' && q3Count >= 30);
        check('monk_streak',       user.Role === '唐三藏' && anyStreakToday >= 14);

        if (candidates.length === 0) return [];

        // ── Batch upsert new achievements (ignoreDuplicates = ON CONFLICT DO NOTHING) ──
        const rows = candidates.map(id => ({ user_id: userId, achievement_id: id }));
        const { data: inserted } = await supabase
            .from('Achievements')
            .upsert(rows, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true })
            .select('achievement_id');

        return (inserted ?? []).map((r: { achievement_id: string }) => r.achievement_id);
    } catch (err) {
        console.error('[achievements] checkAndUnlockAchievements error:', err);
        return [];
    }
}

// ─── Map Achievement Context ──────────────────────────────────────────────────

export interface MapAchievementContext {
    event: 'combat_victory' | 'chest_open' | 'mimic_check' | 'dice_donated' | 'hex_moved' | 'obsidian_passage';
    // Combat fields (for combat_victory)
    monsterType?: 'normal' | 'elite' | 'demon';
    monsterLevel?: number;
    playerLevel?: number;
    playerHPBefore?: number;      // HP entering combat
    playerMaxHP?: number;
    playerStreak?: number;
    playerRole?: string;
    zoneId?: string;              // 'pride' | 'doubt' | 'anger' | 'greed' | 'delusion' | 'chaos'
    distFromOrigin?: number;      // hex distance from (0,0)
    adjacentAllyCount?: number;   // allies within ≤1 hex
    hasAdjacentWujing?: boolean;  // 沙悟淨 specifically adjacent
    healedTeammateCount?: number; // teammates healed (唐三藏 passive)
    killsToday?: number;          // total kills on this logical day AFTER this kill
    // Chest fields (for chest_open / mimic_check)
    lootedGoldenDice?: boolean;
    mimicPassed?: boolean;
}

/**
 * After a map event (combat victory / chest open / dice donated / etc.),
 * evaluate all 40 map achievement conditions and unlock newly-earned ones.
 * Counters in CharacterStats MUST be updated before calling this.
 * Returns IDs of newly unlocked achievements.
 */
export async function checkMapAchievements(
    userId: string,
    ctx: MapAchievementContext,
): Promise<string[]> {
    const supabase = supabaseAdmin;
    try {
        const [userRes, existingRes] = await Promise.all([
            supabase
                .from('CharacterStats')
                .select([
                    'Role', 'Streak',
                    'TotalKills', 'EliteKills', 'DemonKills',
                    'TotalChestsOpened', 'ZonesCleared', 'TotalHexesMoved',
                    'ZoneKillCounts', 'MimicSuccesses', 'DonatedDice',
                    'ObsidianPassages', 'GuardianWins',
                    'FogTrapDate', 'DiceReceivedDate',
                    'DailyKillCount',
                ].join(','))
                .eq('UserID', userId)
                .single(),
            supabase
                .from('Achievements')
                .select('achievement_id')
                .eq('user_id', userId),
        ]);

        if (userRes.error || !userRes.data) return [];
        // Cast to any: new map-achievement columns are not yet in Supabase generated types
        const u = userRes.data as any;
        const alreadyUnlocked = new Set<string>(
            (existingRes.data ?? []).map((r: { achievement_id: string }) => r.achievement_id)
        );

        const today = getLogicalDateStr();
        const candidates: string[] = [];
        const check = (id: string, cond: boolean) => {
            if (!alreadyUnlocked.has(id) && cond) candidates.push(id);
        };

        // ── DB counters (fresh after updates) ────────────────────────────
        const role            = ctx.playerRole ?? u.Role;
        const streak          = ctx.playerStreak ?? u.Streak ?? 0;
        const totalKills      = u.TotalKills ?? 0;
        const eliteKills      = u.EliteKills ?? 0;
        const demonKills      = u.DemonKills ?? 0;
        const chestsOpened    = u.TotalChestsOpened ?? 0;
        const zonesCleared: string[] = Array.isArray(u.ZonesCleared) ? u.ZonesCleared : [];
        const hexesMoved      = u.TotalHexesMoved ?? 0;
        const zoneKillCounts: Record<string, number> = u.ZoneKillCounts ?? {};
        const mimicSuccesses  = u.MimicSuccesses ?? 0;
        const donatedDice     = u.DonatedDice ?? 0;
        const obsidianPasses  = u.ObsidianPassages ?? 0;
        const guardianWins    = u.GuardianWins ?? 0;
        const fogTrapDate     = u.FogTrapDate ?? null;
        const diceReceivedDate = u.DiceReceivedDate ?? null;

        // ── Event-specific ctx values ─────────────────────────────────────
        const isVictory  = ctx.event === 'combat_victory';
        const isChest    = ctx.event === 'chest_open' || ctx.event === 'mimic_check';
        const monsterLv  = ctx.monsterLevel ?? 0;
        const playerLv   = ctx.playerLevel ?? 0;
        const hpBefore   = ctx.playerHPBefore ?? Infinity;
        const maxHP      = ctx.playerMaxHP ?? 1;
        const hpRatio    = maxHP > 0 ? hpBefore / maxHP : 1;
        const dist       = ctx.distFromOrigin ?? 0;
        const killsToday = ctx.killsToday ?? u.DailyKillCount ?? 0;
        const maxZoneKills = Object.values(zoneKillCounts).reduce(
            (acc: number, v: unknown) => Math.max(acc, Number(v) || 0), 0
        );

        // ── Counter-based (check on every event) ─────────────────────────
        check('hexes_100',       hexesMoved >= 100);
        check('zone_specialist', maxZoneKills >= 20);
        check('dice_benefactor', donatedDice >= 5);
        check('wukong_obsidian', obsidianPasses >= 3);
        check('horse_traveler',  role === '白龍馬' && hexesMoved >= 150);

        // ── Combat victory ────────────────────────────────────────────────
        if (isVictory) {
            // Exploration
            check('hometown_guard', dist <= 3);
            check('far_explorer',   dist >= 10 && dist <= 12);
            check('deep_wanderer',  dist >= 13);
            check('zone_all_six',   zonesCleared.length >= 6);
            // Kill milestones
            check('first_blood',    totalKills >= 1);
            check('kills_10',       totalKills >= 10);
            check('kills_30',       totalKills >= 30);
            check('kills_50',       totalKills >= 50);
            check('kills_100',      totalKills >= 100);
            check('kills_200',      totalKills >= 200);
            check('elite_slayer',   eliteKills >= 1);
            check('demon_slayer',   demonKills >= 1);
            // Combat conditions
            check('perfect_victory', hpBefore >= maxHP);
            check('underdog',        monsterLv >= playerLv + 5);
            check('triple_kill_day', killsToday >= 3);
            check('comeback_win',    hpRatio <= 0.30);
            check('near_death',      hpRatio <= 0.10);
            // Team
            check('team_fighter',   (ctx.adjacentAllyCount ?? 0) >= 1);
            check('shield_brother', !!ctx.hasAdjacentWujing && role !== '沙悟淨');
            check('healing_light',  role === '唐三藏' && (ctx.healedTeammateCount ?? 0) >= 2);
            // Cross-day events
            check('fog_survivor',   !!fogTrapDate && fogTrapDate === today);
            check('lucky_heist',    !!diceReceivedDate && diceReceivedDate === today);
            // Streak role-exclusives
            if (streak >= 7) {
                check('wukong_streak7', role === '孫悟空');
                check('bajie_streak7',  role === '豬八戒');
                check('wujing_streak7', role === '沙悟淨');
                check('horse_streak7',  role === '白龍馬');
                check('monk_streak7',   role === '唐三藏');
            }
            // Role-exclusive kill/guardian
            check('wujing_guardian', role === '沙悟淨' && guardianWins >= 5);
        }

        // ── Chest / mimic events ──────────────────────────────────────────
        if (isChest) {
            check('first_chest',     chestsOpened >= 1);
            check('chests_10',       chestsOpened >= 10);
            check('chests_30',       chestsOpened >= 30);
            check('golden_chest',    !!ctx.lootedGoldenDice);
            check('mimic_master',    mimicSuccesses >= 1);
            check('mimic_veteran',   mimicSuccesses >= 5);
            check('bajie_digger',    role === '豬八戒' && chestsOpened >= 15);
        }

        if (candidates.length === 0) return [];

        const rows = candidates.map(id => ({ user_id: userId, achievement_id: id }));
        const { data: inserted } = await supabase
            .from('Achievements')
            .upsert(rows, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true })
            .select('achievement_id');

        return (inserted ?? []).map((r: { achievement_id: string }) => r.achievement_id);
    } catch (err) {
        console.error('[achievements] checkMapAchievements error:', err);
        return [];
    }
}

/** Fetch all achievements unlocked by the given user */
export async function getUserAchievements(userId: string): Promise<AchievementRecord[]> {
    try {
        const supabase = supabaseAdmin;
        const { data, error } = await supabase
            .from('Achievements')
            .select('achievement_id, unlocked_at')
            .eq('user_id', userId)
            .order('unlocked_at', { ascending: true });
        if (error) throw error;
        return (data || []).map((r: { achievement_id: string; unlocked_at: string }) => ({
            achievement_id: r.achievement_id,
            unlocked_at: r.unlocked_at,
        }));
    } catch (err) {
        console.error('[achievements] getUserAchievements error:', err);
        return [];
    }
}
