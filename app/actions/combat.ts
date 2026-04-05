"use server";

import { createClient } from '@supabase/supabase-js';
import { CharacterStats } from '@/types';
import { ROLE_CURE_MAP, DEFAULT_CONFIG } from '@/lib/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseActionKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseActionKey);

interface CombatParams {
    attackerId: string;
    targetId?: string;
    monsterData?: any;
    flankingMultiplier: number; // 1.0 default, 1.3 for flanking, 1.5 for backstab
    remainingAP: number;
    playerDEFOverride?: number; // allow frontend to pass pre-calculated def
    statBuffMultiplier?: number; // i9 九轉金丹: 1.5 for +50% all stats
    hasDeathShield?: boolean;    // i3 錦鑭袈裟: survive lethal hit at 1 HP
    sealMonsterPassive?: boolean; // i4 如意金剛琢: seal monster passive skills
    d1StatBuff?: number;          // d1 五毒精魄: 1.2 (+20%) or 1.4 (+40%, destiny quest done)
    monsterLevelDebuff?: number;  // d2 業障石: reduce monster level by N (usually 3)
    noCritIncoming?: boolean;     // 沙悟淨 定心杵: enemy attacks cannot crit this combat
}

// ── d1–d7 掉落物機率表（依怪物類型）──
const DROP_RATES_BY_TYPE: Record<string, number[]> = {
    normal: [0.08, 0.06, 0.01, 0.00, 0.05, 0.00, 0.00],
    demon:  [0.15, 0.12, 0.08, 0.03, 0.10, 0.05, 0.01],
    elite:  [0.20, 0.18, 0.15, 0.10, 0.12, 0.08, 0.03],
};

/**
 * Resolves a combat exchange between a player and a monster/entity
 */
export async function resolveCombat(params: CombatParams) {
  try {
    const { attackerId, monsterData, flankingMultiplier, remainingAP, playerDEFOverride, statBuffMultiplier = 1.0, hasDeathShield = false, sealMonsterPassive = false, d1StatBuff = 1.0, monsterLevelDebuff = 0, noCritIncoming = false } = params;

    // 1. Fetch Attacker Data
    const { data: attacker, error: fetchErr } = await supabase
        .from('CharacterStats')
        .select('*')
        .eq('UserID', attackerId)
        .single();

    if (fetchErr || !attacker) return { success: false, error: "無法獲取玩家資料" };

    // 2. Base Calculation
    const roleConfig = ROLE_CURE_MAP[attacker.Role] || ROLE_CURE_MAP['孫悟空'];
    // i9 九轉金丹 × d1 五毒精魄 疊加乘數（各自獨立，相乘後套用）
    const combinedStatBuff = statBuffMultiplier * d1StatBuff;
    let baseATK = ((attacker.Level * 10) + (attacker.Physique * 2)) * combinedStatBuff;
    let baseDEF = (roleConfig.baseDEF + (attacker.Physique * 1)) * combinedStatBuff;

    // ── Streak 連續打卡技能（被動加成）──
    const streak = attacker.Streak ?? 0;
    const streakTier = streak >= 7 ? 2 : streak >= 3 ? 1 : 0;
    if (streakTier >= 1) {
        switch (attacker.Role) {
            case '孫悟空': baseATK *= streakTier >= 2 ? 1.4 : 1.2; break;
            case '沙悟淨': baseDEF *= streakTier >= 2 ? 1.35 : 1.2; break;
            case '唐三藏': if (streakTier >= 2) baseATK += (attacker.Charisma ?? 0) * 5; break;
        }
    }

    const baseFinalDEF = playerDEFOverride ?? baseDEF;

    // 天賦「捲簾大將」：若攻擊者相鄰 1 格有隊友沙悟淨，防禦 +10%
    let wujingDefBonus = 1.0;
    if (attacker.Role !== '沙悟淨' && attacker.TeamName) {
        const { data: wujingMembers } = await supabase
            .from('CharacterStats')
            .select('CurrentQ, CurrentR')
            .eq('TeamName', attacker.TeamName)
            .eq('Role', '沙悟淨')
            .neq('UserID', attackerId);
        if (wujingMembers?.length) {
            const adjacent = wujingMembers.some(w => {
                const dq = (w.CurrentQ ?? 0) - (attacker.CurrentQ ?? 0);
                const dr = (w.CurrentR ?? 0) - (attacker.CurrentR ?? 0);
                return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) <= 1;
            });
            if (adjacent) wujingDefBonus = 1.1;
        }
    }
    const finalDEF = baseFinalDEF * wujingDefBonus;

    // 3. Monster Power
    // d2 業障石：降低怪物等級（最低 1）
    const monsterLevel = Math.max(1, (monsterData.level || 1) - monsterLevelDebuff);
    // effectiveLevel tracks player level at 75% floor — ensures mid/late-game players still feel pressure
    const effectiveLevel = Math.max(monsterLevel, Math.floor(attacker.Level * 0.75));
    let monsterATK = effectiveLevel * 12;
    let monsterDEF = effectiveLevel * 8;
    // Recalculate HP from effectiveLevel so it scales with the player, same formula as admin.ts generation
    const isEliteMonster = monsterData.type === 'elite';
    let monsterHP = isEliteMonster
        ? Math.round((50 + effectiveLevel * 15) * 1.5)
        : 50 + effectiveLevel * 15;

    // 六維素質對應難度加成：屬性越高，面對的怪物稍強（戰鬥結算時動態套用，不改 DB）
    // 悟性/神識 → 怪物 ATK，根骨/潛力 → 怪物 DEF，魅力/福緣 → 怪物 HP
    monsterATK += Math.floor((attacker.Savvy ?? 0) / 15) + Math.floor((attacker.Spirit ?? 0) / 20);
    monsterDEF += Math.floor((attacker.Physique ?? 0) / 15) + Math.floor((attacker.Potential ?? 0) / 20);
    monsterHP  += Math.floor((attacker.Charisma ?? 0) / 10) * 30 + Math.floor((attacker.Luck ?? 0) / 10) * 20;

    // 4. Combo Calculation (AP to Strikes)
    let totalPlayerDamage = 0;
    const battleLog: any[] = [];
    const luck = attacker.Luck || 5;

    // 白龍馬 Streak：戰鬥前額外 AP
    let effectiveAP = remainingAP;
    if (attacker.Role === '白龍馬' && streakTier >= 1) {
        effectiveAP += streakTier >= 2 ? 2 : 1;
    }

    // 孫悟空 Streak ≥ 7：暴擊率 +15%
    const critBonus = (attacker.Role === '孫悟空' && streakTier >= 2) ? 15 : 0;

    for (let i = 0; i < effectiveAP; i++) {
        // Luck check for Hit / Crit
        const roll = Math.random() * 100;
        let isCrit = false;
        let isMiss = false;

        const missChance = Math.max(0, (10 - luck) * 2); // Luck 3 -> 14% miss
        const critChance = luck * 5 + critBonus; // Luck 8 -> 40% crit (+ streak bonus for 孫悟空 Lv7)

        if (roll < missChance) {
            isMiss = true;
            battleLog.push({ hit: i + 1, type: 'miss', damage: 0 });
            continue;
        }

        if (roll > 100 - critChance) {
            isCrit = true;
        }

        // Only first hit gets tactical multiplier
        const currentFlank = i === 0 ? flankingMultiplier : 1.0;
        let hitDamage = Math.max(1, Math.floor((baseATK * currentFlank) - monsterDEF));

        if (isCrit) {
            hitDamage = Math.floor(hitDamage * 1.5);
        }

        totalPlayerDamage += hitDamage;
        monsterHP -= hitDamage;
        battleLog.push({ hit: i + 1, type: isCrit ? 'crit' : 'hit', damage: hitDamage, flank: currentFlank });

        // Monster Passive trigger (Example: 嗔區 Frenzy)
        // i4 如意金剛琢：sealMonsterPassive skips passive triggers
        if (!sealMonsterPassive && (monsterData.zone === '嗔' || monsterData.traits?.includes('frenzy'))) {
            monsterATK += 5; // Monster gets angrier each hit
        }

        if (monsterHP <= 0) break;
    }

    // 5. Monster Counter Attack (Phase A)
    // If monster survived the combo, it counter-attacks
    let totalMonsterDamage = 0;
    const isVictory = monsterHP <= 0;

    if (!isVictory) {
        let baseDamage = Math.max(5, monsterATK - finalDEF);
        // 怪物 10% 機率爆擊（×1.5）；定心杵免疫
        if (!noCritIncoming && Math.random() < 0.10) {
            baseDamage = Math.floor(baseDamage * 1.5);
        }
        totalMonsterDamage = baseDamage;
    }

    // 6. Apply Results
    const currentHP = attacker.HP ?? (roleConfig.baseHP + (attacker.Physique * roleConfig.hpScale));
    let deathShieldTriggered = false;
    let newHP = Math.max(0, currentHP - totalMonsterDamage);
    // i3 錦鑭袈裟：致死傷害保留 1 HP
    if (hasDeathShield && !isVictory && newHP === 0) {
        newHP = 1;
        deathShieldTriggered = true;
    }

    // 7. Update Database (Rewards + HP)
    let coinReward = 0;
    let totalDiceReward = 0;
    let goldenDiceReward = 0;
    let rewardMsg = "";
    if (isVictory) {
        // Rewards Calculation (戰鬥不給經驗值，只給金幣與道具)
        coinReward = Math.floor(effectiveLevel * 20);
        const diceRewardRoll = Math.random();
        const hasDiceReward = diceRewardRoll < 0.1; // 10% chance
        let baseDiceReward = hasDiceReward ? 1 : 0;

        // ── 心魔怪 (Demon) 特殊掉落：重啟骰子 ──
        const isDemon = monsterData.type === 'demon' || monsterData.traits?.includes('demon');
        let demonDiceBonus = 0;
        let isServerWideDrop = false;

        if (isDemon) {
            // 心魔等級決定重啟骰子掉落：Lv1-3→1, Lv4-6→2, Lv7+→3
            demonDiceBonus = monsterLevel <= 3 ? 1 : monsterLevel <= 6 ? 2 : 3;
            // 5% 機率觸發全服骰子事件
            isServerWideDrop = Math.random() < 0.05;
        }

        // ── 精英怪特殊掉落 ──
        const isElite = monsterData.type === 'elite';
        let eliteDiceBonus = 0;
        if (isElite) {
            coinReward = Math.floor(coinReward * 2);     // 金幣 ×2
            eliteDiceBonus = 2;                           // 保底 +2 能源骰子
        }

        totalDiceReward = baseDiceReward + demonDiceBonus + eliteDiceBonus;
        goldenDiceReward = isElite
            ? (Math.random() < 0.10 ? 1 : 0)  // 精英：10%
            : (Math.random() < 0.02 ? 1 : 0); // 普通：2%

        // Individual + Team Update (atomic via RPC)
        const teamBonus = attacker.TeamName ? Math.floor(coinReward * 0.2) : 0;
        const { error: rewardErr } = await supabase.rpc('add_combat_rewards', {
            p_user_id: attackerId,
            p_exp: 0,
            p_coins: 0,              // Quest Coins not awarded by combat
            p_dice: totalDiceReward,
            p_golden_dice: goldenDiceReward,
            p_new_hp: newHP,
            p_game_gold: coinReward, // Combat currency → CharacterStats.GameGold
            p_team_name: attacker.TeamName ?? null,
            p_team_bonus: teamBonus, // 20% team pool bonus (atomically in same RPC)
        });

        if (rewardErr) return { success: false, error: "獎勵領取失敗：" + rewardErr.message };

        // 全服骰子事件：廣播通知 + 全體玩家 +1 骰子
        if (isServerWideDrop) {
            try { await supabase.rpc('global_dice_bonus', { p_amount: 1 }); } catch (_) { /* non-critical */ }
        }

        rewardMsg = ` 獲得 ${coinReward} 金幣`;
        if (totalDiceReward > 0) rewardMsg += `, ${totalDiceReward} 能源骰子`;
        if (demonDiceBonus > 0) rewardMsg += ` (含心魔掉落 ${demonDiceBonus})`;
        if (eliteDiceBonus > 0) rewardMsg += ` (含精英掉落 ${eliteDiceBonus})`;
        if (goldenDiceReward > 0) rewardMsg += `, 1 黃金骰子！`;
        rewardMsg += '。';
        if (isServerWideDrop) rewardMsg += " 🌟 觸發全服事件！所有冒險者各獲得 1 個能源骰子！";
    } else {
        // Regular HP Update
        const { error: updateErr } = await supabase
            .from('CharacterStats')
            .update({ HP: newHP })
            .eq('UserID', attackerId);
        if (updateErr) return { success: false, error: "戰鬥結算失敗：" + updateErr.message };
    }

    // 8. Handle Entity Persistence
    if (params.targetId && isVictory) {
        const { error: deleteErr } = await supabase.from('MapEntities').delete().eq('id', params.targetId);
        if (deleteErr) console.error('[combat] MapEntities delete failed:', deleteErr.message);
    } else if (params.targetId && !isVictory) {
        const { error: hpErr } = await supabase.from('MapEntities')
            .update({ data: { ...monsterData, hp: monsterHP } })
            .eq('id', params.targetId);
        if (hpErr) console.error('[combat] MapEntities hp update failed:', hpErr.message);
    }

    // 9. Streak post-battle effects
    let drops: string[] = [];
    if (isVictory) {
        // 唐三藏天賦「信念之光」：戰勝後以自身為中心，2 格內所有隊友（含自身）回復 10% MaxHP
        if (attacker.Role === '唐三藏') {
            const selfMaxHP = roleConfig.baseHP + (attacker.Physique * roleConfig.hpScale);
            const selfHeal = Math.ceil(selfMaxHP * 0.10);
            await supabase.from('CharacterStats')
                .update({ HP: Math.min(selfMaxHP, newHP + selfHeal) })
                .eq('UserID', attackerId);

            if (attacker.TeamName) {
                const { data: teammates } = await supabase
                    .from('CharacterStats')
                    .select('UserID, Role, Physique, HP, CurrentQ, CurrentR')
                    .eq('TeamName', attacker.TeamName)
                    .neq('UserID', attackerId);
                for (const tm of teammates ?? []) {
                    const dq = (tm.CurrentQ ?? 0) - (attacker.CurrentQ ?? 0);
                    const dr = (tm.CurrentR ?? 0) - (attacker.CurrentR ?? 0);
                    if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) > 2) continue;
                    const tmConfig = ROLE_CURE_MAP[tm.Role] || ROLE_CURE_MAP['孫悟空'];
                    const tmMaxHP = tmConfig.baseHP + ((tm.Physique ?? 0) * tmConfig.hpScale);
                    const tmHeal = Math.ceil(tmMaxHP * 0.10);
                    await supabase.from('CharacterStats')
                        .update({ HP: Math.min(tmMaxHP, (tm.HP ?? tmMaxHP) + tmHeal) })
                        .eq('UserID', tm.UserID);
                }
            }
        }

        // 沙悟淨 Streak ≥ 7：首次致死免疫（已在 deathShield 邏輯中處理，此處無需額外操作）

        // 10. d1–d7 掉落物（依怪物類型計算機率）
        const monsterType = monsterData.type === 'elite' ? 'elite'
            : (monsterData.type === 'demon' || monsterData.traits?.includes('demon')) ? 'demon'
            : 'normal';
        const rates = DROP_RATES_BY_TYPE[monsterType] ?? DROP_RATES_BY_TYPE.normal;
        const luckMod = 1 + (attacker.Luck ?? 0) * 0.02;
        // d3 心魔殘骸：對心魔怪掉落機率的永久加成（DemonDropBoostSeasonal 例如 0.10 = +10%）
        const demonBoost = monsterType === 'demon' ? 1 + (attacker.DemonDropBoostSeasonal ?? 0) : 1;

        for (let i = 0; i < 7; i++) {
            if (rates[i] <= 0) continue;
            // d7 渾天至寶珠：季節唯一（檢查 TeamSettings.inventory）
            if (i === 6 && attacker.TeamName) {
                const { data: ts } = await supabase
                    .from('TeamSettings').select('inventory').eq('team_name', attacker.TeamName).single();
                const teamInv: string[] = typeof ts?.inventory === 'string'
                    ? JSON.parse(ts.inventory) : (ts?.inventory ?? []);
                if (teamInv.includes('d7')) continue;
            }
            if (Math.random() < rates[i] * luckMod * demonBoost) drops.push(`d${i + 1}`);
        }

        if (drops.length > 0) {
            const currentInv: Array<{ id: string; count: number }> = attacker.GameInventory ?? [];
            for (const dropId of drops) {
                const existing = currentInv.find(it => it.id === dropId);
                if (existing) { existing.count++; } else { currentInv.push({ id: dropId, count: 1 }); }
            }
            await supabase.from('CharacterStats')
                .update({ GameInventory: currentInv })
                .eq('UserID', attackerId);
            if (drops.includes('d7') && attacker.TeamName) {
                const { data: ts } = await supabase
                    .from('TeamSettings').select('inventory').eq('team_name', attacker.TeamName).single();
                const teamInv: string[] = typeof ts?.inventory === 'string'
                    ? JSON.parse(ts.inventory) : (ts?.inventory ?? []);
                if (!teamInv.includes('d7')) {
                    await supabase.from('TeamSettings')
                        .update({ inventory: JSON.stringify([...teamInv, 'd7']) })
                        .eq('team_name', attacker.TeamName);
                }
            }
        }
    }

    return {
        success: true,
        isVictory,
        deathShieldTriggered,
        totalPlayerDamage,
        totalMonsterDamage,
        newHP,
        coinReward: isVictory ? coinReward : 0,
        diceReward: totalDiceReward,
        goldenDiceReward,
        drops: isVictory ? (drops ?? []) : [],
        monsterRemainingHP: Math.max(0, monsterHP),
        battleLog,
        message: isVictory
            ? `大獲全勝！你發動 ${battleLog.length} 次連擊造成 ${totalPlayerDamage} 點傷害，擊殺心魔。${rewardMsg}`
            : `你發動 ${battleLog.length} 次連擊造成 ${totalPlayerDamage} 點傷害，遭到反擊受到 ${totalMonsterDamage} 點傷害。`
    };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "戰鬥發生未知錯誤" };
  }
}
