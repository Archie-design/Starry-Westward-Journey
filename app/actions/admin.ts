'use server';

import { connectDb } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';
import { TERRAIN_TYPES } from '@/lib/constants';

const _supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const _supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// ── GM 身份驗證 ────────────────────────────────────────
export async function getGMUserByUID(uid: string): Promise<{ success: boolean; name?: string; error?: string }> {
    const supabase = createClient(_supabaseUrl, _supabaseKey);
    const { data } = await supabase
        .from('CharacterStats')
        .select('Name, IsGM')
        .eq('UserID', uid)
        .maybeSingle();
    if (!data) return { success: false, error: '查無此修行者。' };
    if (!data.IsGM) return { success: false, error: '此帳號無管理員權限。' };
    return { success: true, name: data.Name };
}

// ── 通用管理操作 Log ──────────────────────────────────────
export async function logAdminAction(
    action: string,
    actor: string,
    targetId?: string,
    targetName?: string,
    details?: Record<string, any>,
    result: 'success' | 'error' = 'success'
) {
    try {
        const supabase = createClient(_supabaseUrl, _supabaseKey);
        await supabase.from('AdminActivityLog').insert({
            action, actor, target_id: targetId, target_name: targetName, details, result,
        });
    } catch (_) { /* log failure should never break the main flow */ }
}

export async function triggerWeeklySnapshot(actorName = 'system') {
    
    const client = await connectDb();
    try {
        await client.query('BEGIN');

        // 1. Calculate past 7 days boundary
        const today = new Date();
        const past7Date = new Date();
        past7Date.setDate(today.getDate() - 7);
        const past7ISO = past7Date.toISOString();

        // 2. Find active users (who have logged anything in the last 7 days)
        const activeUsersRes = await client.query(`
            SELECT DISTINCT "UserID" FROM "DailyLogs"
            WHERE "Timestamp" >= $1
        `, [past7ISO]);

        const activeUsersCount = activeUsersRes.rowCount || 0;

        if (activeUsersCount === 0) {
            await client.query('COMMIT');
            return { success: true, worldState: 'normal', rate: 0, message: "過去 7 天無活躍使用者，環境保持平衡。" };
        }

        // 3. Count total daily quests (q1~q7) completed by these active users in last 7 days
        const logsRes = await client.query(`
            SELECT COUNT(*) as count FROM "DailyLogs"
            WHERE "Timestamp" >= $1 AND "QuestID" LIKE 'q%'
        `, [past7ISO]);

        const totalQuests = parseInt(logsRes.rows[0].count, 10);

        // 4. Calculate Rate (Max 3 quests/day per active user * 7 days = 21 max per user)
        const maxPossible = activeUsersCount * 21;
        const rate = totalQuests / maxPossible;

        // 5. Determine new World State
        let worldState = 'normal';
        let stateMsg = "【世俗】眾生修行平平，三界維持恐怖平衡。";
        if (rate > 0.8) {
            worldState = 'good';
            stateMsg = "【共好】全服精進達標！靈氣復甦，天降祥瑞與寶箱。";
        } else if (rate < 0.5) {
            worldState = 'bad';
            stateMsg = "【共業】全服懈怠！妖氣沖天，西北混沌區「世界王」結界鬆動。";
        }

        // 6. Update SystemSettings
        await client.query(`
            INSERT INTO "SystemSettings" ("SettingName", "Value") 
            VALUES ('WorldState', $1)
            ON CONFLICT ("SettingName") DO UPDATE SET "Value" = EXCLUDED."Value"
        `, [worldState]);

        await client.query(`
            INSERT INTO "SystemSettings" ("SettingName", "Value") 
            VALUES ('WorldStateMsg', $1)
            ON CONFLICT ("SettingName") DO UPDATE SET "Value" = EXCLUDED."Value"
        `, [stateMsg]);

        // 7. Load already-occupied hexes (preserve unclaimed chests/monsters)
        const { rows: occupiedRows } = await client.query<{ q: number; r: number }>(
            `SELECT q, r FROM "MapEntities"`
        );
        const occupiedSet = new Set(occupiedRows.map(e => `${e.q},${e.r}`));

        // 7b. Load terrain data and build impassable hex set
        const supabaseForTerrain = createClient(_supabaseUrl, _supabaseKey);
        const { data: mapWorldData } = await supabaseForTerrain
            .from('world_maps')
            .select('data')
            .eq('id', 'main_world_map')
            .single();
        const terrainMap: Record<string, string> = (mapWorldData?.data as any)?.terrain ?? {};
        // Parse all terrain keys (format: "zone_subIdx_q,r") to build impassable coordinate set
        const impassableHexes = new Set<string>();
        for (const [key, terrainId] of Object.entries(terrainMap)) {
            if (TERRAIN_TYPES[terrainId]?.impassable) {
                // Key format: "center_0_q,r" or "zoneid_N_q,r" — extract last segment
                const coords = key.split('_').slice(-1)[0]; // "q,r"
                impassableHexes.add(coords);
            }
        }

        // 8. Generate new procedural entities based on worldState
        const chanceChest = worldState === 'good' ? 0.05 : worldState === 'bad' ? 0.01 : 0.02;
        const chanceMonster = worldState === 'good' ? 0.01 : worldState === 'bad' ? 0.08 : 0.02;

        // Global caps — scale with active player count, capped at 150 to protect map density
        const BASE_MONSTERS = Math.min(activeUsersCount * 2, 150);
        const MAX_MONSTERS = worldState === 'bad'    ? BASE_MONSTERS * 2
                           : worldState === 'normal' ? BASE_MONSTERS
                           : Math.floor(BASE_MONSTERS * 0.4); // good: fewer monsters, more chests
        const MAX_CHESTS   = worldState === 'good' ? 40 : worldState === 'normal' ? 25 : 10;
        let monsterCount = 0;
        let chestCount = 0;

        // Zone direction lookup (same order as ZONES in constants.tsx)
        // pride=N, doubt=NE, anger=SE, greed=S, delusion=SW, chaos=NW
        const getZoneId = (q: number, r: number): string => {
            const s = -q - r;
            if (r < 0 && s > 0 && Math.abs(q) <= Math.abs(r)) return 'pride';
            if (q > 0 && r < 0) return 'doubt';
            if (q > 0 && s < 0) return 'anger';
            if (r > 0 && s < 0 && Math.abs(q) <= Math.abs(r)) return 'greed';
            if (q < 0 && r > 0) return 'delusion';
            if (q < 0 && s > 0) return 'chaos';
            return 'center';
        };

        // Build shuffled candidate list (skips center and already-occupied hexes)
        const R = 15;
        const candidates: { q: number; r: number }[] = [];
        for (let q = -R; q <= R; q++) {
            for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
                if (q === 0 && r === 0) continue; // Safe hub
                if (occupiedSet.has(`${q},${r}`)) continue; // Skip occupied hexes
                if (impassableHexes.has(`${q},${r}`)) continue; // Skip impassable terrain
                candidates.push({ q, r });
            }
        }
        // Fisher-Yates shuffle for uniform zone distribution
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        for (const { q, r } of candidates) {
            if (monsterCount >= MAX_MONSTERS && chestCount >= MAX_CHESTS) break;

            const rand = Math.random();
            if (rand < chanceChest && chestCount < MAX_CHESTS) {
                await client.query(`
                    INSERT INTO "MapEntities" (q, r, type, name, icon)
                    VALUES ($1, $2, 'treasure', '神秘寶箱', '🎁')
                `, [q, r]);
                chestCount++;
            } else if (rand < chanceChest + chanceMonster && monsterCount < MAX_MONSTERS) {
                // Level scales with axial distance from center (Lv1 near hub, Lv20 at edges)
                const dist = (Math.abs(q) + Math.abs(r) + Math.abs(-q - r)) / 2;
                const level = Math.min(20, Math.max(1, Math.ceil(dist * 1.3)));
                const isElite = level >= 10 && Math.random() < 0.25;
                const hp = isElite ? Math.round((50 + level * 15) * 1.5) : 50 + level * 15;
                const zoneId = getZoneId(q, r);
                const zoneMonsterNames: Record<string, string> = {
                    pride: '慢心魔', doubt: '疑心魔', anger: '嗔心魔',
                    greed: '貪心魔', delusion: '痴心魔', chaos: '亂心魔',
                };
                const baseName = zoneMonsterNames[zoneId] ?? '野生妖獸';
                const monsterName = isElite ? `精英${baseName}` : baseName;
                const monsterIcon = isElite ? '👹' : '🐉';
                const monsterData = isElite ? { level, hp, zone: zoneId, type: 'elite' } : { level, hp, zone: zoneId };
                await client.query(`
                    INSERT INTO "MapEntities" (q, r, type, name, icon, data)
                    VALUES ($1, $2, 'monster', $3, $4, $5)
                `, [q, r, monsterName, monsterIcon, JSON.stringify(monsterData)]);
                monsterCount++;
            }
        }

        await client.query('COMMIT');
        await logAdminAction('weekly_snapshot', actorName, undefined, undefined, { worldState, rate: Math.round(rate * 100) + '%' });
        return { success: true, worldState, rate, message: stateMsg };

    } catch (error: any) {
        await client.query('ROLLBACK');
        await logAdminAction('weekly_snapshot', actorName, undefined, undefined, { error: error.message }, 'error');
        return { success: false, error: error.message };
    } finally {
        await client.end();
    }
}

export async function checkWeeklyW3Compliance(startMondayISO?: string, endMondayISO?: string, actorName = 'system') {

    const client = await connectDb();
    try {
        // 計算雙週範圍：預設為「前兩週週一」至「本週週一」（共 14 天）
        let weekStart: Date;
        let weekEnd: Date;

        if (startMondayISO && endMondayISO) {
            weekStart = new Date(startMondayISO);
            // endMondayISO 是第二週的週一，加 7 天得週日結束
            weekEnd = new Date(endMondayISO);
            weekEnd.setDate(weekEnd.getDate() + 7);
        } else {
            // 預設：往回推 14 天（兩週前週一 → 本週週一）
            const today = new Date();
            const day = today.getDay() || 7;
            const thisMonday = new Date(today);
            thisMonday.setDate(today.getDate() - (day - 1));
            thisMonday.setHours(0, 0, 0, 0);
            weekStart = new Date(thisMonday);
            weekStart.setDate(thisMonday.getDate() - 14);
            weekEnd = new Date(thisMonday);
        }

        // period_label 類似 "2026-03-03~2026-03-10"（兩週起訖週一）
        const isoW1 = weekStart.toISOString().slice(0, 10);
        const w2Start = new Date(weekStart);
        w2Start.setDate(w2Start.getDate() + 7);
        const isoW2 = w2Start.toISOString().slice(0, 10);
        const periodLabel = `${isoW1}~${isoW2}`;

        // Get all users
        const usersRes = await client.query<{ UserID: string; Name: string; TotalFines: number }>(
            `SELECT "UserID", "Name", "TotalFines" FROM "CharacterStats"`
        );

        // Get all w3 logs in that bi-weekly range
        const logsRes = await client.query<{ UserID: string }>(
            `SELECT "UserID" FROM "DailyLogs"
             WHERE "QuestID" LIKE 'w3%'
               AND "Timestamp" >= $1 AND "Timestamp" < $2`,
            [weekStart.toISOString(), weekEnd.toISOString()]
        );

        const completedUserIds = new Set(logsRes.rows.map(r => r.UserID));

        const violators: { userId: string; name: string }[] = [];

        await client.query('BEGIN');
        for (const user of usersRes.rows) {
            if (!completedUserIds.has(user.UserID)) {
                violators.push({ userId: user.UserID, name: user.Name });
                await client.query(
                    `UPDATE "CharacterStats" SET "TotalFines" = "TotalFines" + 200 WHERE "UserID" = $1`,
                    [user.UserID]
                );
            }
        }
        await client.query('COMMIT');

        await logAdminAction('w3_compliance', actorName, undefined, periodLabel, {
            totalUsers: usersRes.rowCount || 0,
            violatorCount: violators.length,
            violators: violators.map(v => v.name),
            periodLabel,
        });
        return {
            success: true,
            periodLabel,
            totalUsers: usersRes.rowCount || 0,
            violatorCount: violators.length,
            violators,
        };
    } catch (error: any) {
        await client.query('ROLLBACK');
        await logAdminAction('w3_compliance', actorName, undefined, undefined, { error: error.message }, 'error');
        return { success: false, error: error.message };
    } finally {
        await client.end();
    }
}


const ZH_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

/**
 * 測試用：將現有玩家隨機分配到大隊 / 小隊，並自動設定隊長與 TeamSettings。
 * 每支小隊 SQUAD_SIZE 人，每個大隊 SQUADS_PER_BATTALION 支小隊。
 * 可重複執行（覆蓋舊值）。
 */
export async function autoAssignSquadsForTesting(
    squadSize = 4,
    squadsPerBattalion = 3,
    actorName = 'system'
) {
    
    const client = await connectDb();
    try {
        await client.query('BEGIN');

        // 1. 取得所有玩家並隨機排列
        const { rows: allUsers } = await client.query<{ UserID: string; Name: string }>(
            `SELECT "UserID", "Name" FROM "CharacterStats" ORDER BY "UserID"`
        );
        if (allUsers.length === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '資料庫中尚無玩家' };
        }

        // Fisher-Yates shuffle
        for (let i = allUsers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allUsers[i], allUsers[j]] = [allUsers[j], allUsers[i]];
        }

        // 2. 分組
        const squads: { battalionName: string; squadName: string; members: typeof allUsers }[] = [];
        for (let i = 0; i < allUsers.length; i += squadSize) {
            const squadIdx = squads.length;
            const battalionIdx = Math.floor(squadIdx / squadsPerBattalion);
            const squadInBattalion = (squadIdx % squadsPerBattalion) + 1;
            const battalionName = `第${ZH_NUMS[battalionIdx] ?? battalionIdx + 1}大隊`;
            const squadName = `${battalionName}-小隊${ZH_NUMS[squadInBattalion - 1] ?? squadInBattalion}`;
            squads.push({ battalionName, squadName, members: allUsers.slice(i, i + squadSize) });
        }

        // 3. 更新 CharacterStats + upsert TeamSettings
        for (const squad of squads) {
            for (let mi = 0; mi < squad.members.length; mi++) {
                const user = squad.members[mi];
                const isCaptain = mi === 0;
                await client.query(
                    `UPDATE "CharacterStats"
                     SET "SquadName" = $1, "TeamName" = $2, "IsCaptain" = $3
                     WHERE "UserID" = $4`,
                    [squad.battalionName, squad.squadName, isCaptain, user.UserID]
                );
            }
            await client.query(
                `INSERT INTO "TeamSettings" (team_name, team_coins)
                 VALUES ($1, 0)
                 ON CONFLICT (team_name) DO NOTHING`,
                [squad.squadName]
            );
        }

        await client.query('COMMIT');

        await logAdminAction('auto_assign_squads', actorName, undefined, undefined, {
            totalPlayers: allUsers.length,
            squadCount: squads.length,
            battalionCount: Math.ceil(squads.length / squadsPerBattalion),
        });
        return {
            success: true,
            totalPlayers: allUsers.length,
            squadCount: squads.length,
            battalionCount: Math.ceil(squads.length / squadsPerBattalion),
            summary: squads.map(s => ({
                squad: s.squadName,
                members: s.members.map((m, i) => `${m.Name}${i === 0 ? '（隊長）' : ''}`)
            })),
        };
    } catch (error: any) {
        await client.query('ROLLBACK');
        await logAdminAction('auto_assign_squads', actorName, undefined, undefined, { error: error.message }, 'error');
        return { success: false, error: error.message };
    } finally {
        await client.end();
    }
}

export async function importRostersData(csvContent: string, actorName = 'system') {
    
    const client = await connectDb();

    try {
        await client.query('BEGIN');

        const rows = csvContent.split('\n');
        let count = 0;

        for (const row of rows) {
            const cols = row.split(',').map(c => c.trim());
            // Expecting: email, name, birthday, squad_name(大隊), team_name(小隊), is_captain, is_commandant
            const email = cols[0]?.toLowerCase();
            if (!email || !email.includes('@')) continue;

            const name = cols[1] || null;
            const birthday = cols[2] && /^\d{4}-\d{2}-\d{2}$/.test(cols[2]) ? cols[2] : null;
            const squad_name = cols[3] || null;
            const team_name = cols[4] || null;
            const is_captain = String(cols[5]).toLowerCase() === 'true';
            const is_commandant = String(cols[6]).toLowerCase() === 'true';

            await client.query(`
                INSERT INTO "Rosters" (email, name, birthday, squad_name, team_name, is_captain, is_commandant)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (email)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    birthday = EXCLUDED.birthday,
                    squad_name = EXCLUDED.squad_name,
                    team_name = EXCLUDED.team_name,
                    is_captain = EXCLUDED.is_captain,
                    is_commandant = EXCLUDED.is_commandant
            `, [email, name, birthday, squad_name, team_name, is_captain, is_commandant]);

            // If they already created a CharacterStat, automatically sync all fields
            await client.query(`
                UPDATE "CharacterStats"
                SET "SquadName" = $2, "TeamName" = $3, "IsCaptain" = $4, "IsCommandant" = $5,
                    "Birthday" = COALESCE($6, "Birthday")
                WHERE "Email" = $1
            `, [email, squad_name, team_name, is_captain, is_commandant, birthday]);

            count++;
        }

        await client.query('COMMIT');
        await logAdminAction('roster_import', actorName, undefined, undefined, { count });
        return { success: true, count };
    } catch (error: any) {
        await client.query('ROLLBACK');
        await logAdminAction('roster_import', actorName, undefined, undefined, { error: error.message }, 'error');
        return { success: false, error: error.message };
    } finally {
        await client.end();
    }
}

// ── 玩家設定生日 ────────────────────────────────────────
export async function updateSystemSetting(key: string, value: string) {
    const supabase = createClient(_supabaseUrl, _supabaseKey);
    const { error } = await supabase
        .from('SystemSettings')
        .upsert({ SettingName: key, Value: value }, { onConflict: 'SettingName' });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function deleteTestimony(id: string) {
    const supabase = createClient(_supabaseUrl, _supabaseKey);
    const { error } = await supabase.from('Testimonies').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function saveBirthday(userId: string, birthday: string) {
    // Validate format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return { success: false, error: '日期格式錯誤，請使用 YYYY-MM-DD' };
    const supabase = createClient(_supabaseUrl, _supabaseKey);
    const { error } = await supabase
        .from('CharacterStats')
        .update({ Birthday: birthday })
        .eq('UserID', userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}
