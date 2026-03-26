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
}

/**
 * Resolves a combat exchange between a player and a monster/entity
 */
export async function resolveCombat(params: CombatParams) {
    const { attackerId, monsterData, flankingMultiplier, remainingAP, playerDEFOverride } = params;

    // 1. Fetch Attacker Data
    const { data: attacker, error: fetchErr } = await supabase
        .from('CharacterStats')
        .select('*')
        .eq('UserID', attackerId)
        .single();

    if (fetchErr || !attacker) throw new Error("無法獲取玩家資料");

    // 2. Base Calculation
    const roleConfig = ROLE_CURE_MAP[attacker.Role] || ROLE_CURE_MAP['孫悟空'];
    const baseATK = (attacker.Level * 10) + (attacker.Physique * 2);
    const baseDEF = roleConfig.baseDEF + (attacker.Physique * 1);

    const finalDEF = playerDEFOverride ?? baseDEF;

    // 3. Monster Power
    const monsterLevel = monsterData.level || 1;
    // effectiveLevel tracks player level at 75% floor — ensures mid/late-game players still feel pressure
    const effectiveLevel = Math.max(monsterLevel, Math.floor(attacker.Level * 0.75));
    let monsterATK = effectiveLevel * 12;
    let monsterDEF = effectiveLevel * 8;
    let monsterHP = monsterData.hp || 100;

    // 六維素質對應難度加成：屬性越高，面對的怪物稍強（戰鬥結算時動態套用，不改 DB）
    // 悟性/神識 → 怪物 ATK，根骨/潛力 → 怪物 DEF，魅力/福緣 → 怪物 HP
    monsterATK += Math.floor((attacker.Savvy ?? 0) / 15) + Math.floor((attacker.Spirit ?? 0) / 20);
    monsterDEF += Math.floor((attacker.Physique ?? 0) / 15) + Math.floor((attacker.Potential ?? 0) / 20);
    monsterHP  += Math.floor((attacker.Charisma ?? 0) / 10) * 30 + Math.floor((attacker.Luck ?? 0) / 10) * 20;

    // 4. Combo Calculation (AP to Strikes)
    let totalPlayerDamage = 0;
    const battleLog: any[] = [];
    const luck = attacker.Luck || 5;

    for (let i = 0; i < remainingAP; i++) {
        // Luck check for Hit / Crit
        const roll = Math.random() * 100;
        let isCrit = false;
        let isMiss = false;

        const missChance = Math.max(0, (10 - luck) * 2); // Luck 3 -> 14% miss
        const critChance = luck * 5; // Luck 8 -> 40% crit

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
        // If it's a specific monster type, getting hit increases its ATK
        if (monsterData.zone === '嗔' || monsterData.traits?.includes('frenzy')) {
            monsterATK += 5; // Monster gets angrier each hit
        }

        if (monsterHP <= 0) break;
    }

    // 5. Monster Counter Attack (Phase A)
    // If monster survived the combo, it counter-attacks
    let totalMonsterDamage = 0;
    const isVictory = monsterHP <= 0;

    if (!isVictory) {
        totalMonsterDamage = Math.max(5, monsterATK - finalDEF);
    }

    // 6. Apply Results
    const currentHP = attacker.HP ?? (roleConfig.baseHP + (attacker.Physique * roleConfig.hpScale));
    const newHP = Math.max(0, currentHP - totalMonsterDamage);

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

        // Individual Update
        const { error: rewardErr } = await supabase.rpc('add_combat_rewards', {
            p_user_id: attackerId,
            p_exp: 0,
            p_coins: coinReward,
            p_dice: totalDiceReward,
            p_golden_dice: goldenDiceReward,
            p_new_hp: newHP
        });

        if (rewardErr) throw new Error("獎勵領取失敗：" + rewardErr.message);

        // 全服骰子事件：廣播通知 + 全體玩家 +1 骰子
        if (isServerWideDrop) {
            try { await supabase.rpc('global_dice_bonus', { p_amount: 1 }); } catch (_) { /* non-critical */ }
        }

        // Collective Reward (Team Coins)
        if (attacker.TeamName) {
            const teamBonus = Math.floor(coinReward * 0.2); // 20% bonus to team pool
            await supabase.from('TeamSettings')
                .update({ team_coins: supabase.rpc('increment', { x: teamBonus }) })
                .eq('team_name', attacker.TeamName);
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
        if (updateErr) throw new Error("戰鬥結算失敗：" + updateErr.message);
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

    return {
        success: true,
        isVictory,
        totalPlayerDamage,
        totalMonsterDamage,
        newHP,
        coinReward: isVictory ? coinReward : 0,
        diceReward: totalDiceReward,
        goldenDiceReward,
        monsterRemainingHP: Math.max(0, monsterHP),
        battleLog,
        message: isVictory 
            ? `大獲全勝！你發動 ${battleLog.length} 次連擊造成 ${totalPlayerDamage} 點傷害，擊殺心魔。${rewardMsg}` 
            : `你發動 ${battleLog.length} 次連擊造成 ${totalPlayerDamage} 點傷害，遭到反擊受到 ${totalMonsterDamage} 點傷害。`
    };
}
