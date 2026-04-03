"use server";

import { createClient } from "@supabase/supabase-js";
import { CHEST_LOOT_TABLE, MIMIC_CHANCE } from "@/lib/constants";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseActionKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * 處理開箱子邏輯
 * 包含寶箱怪檢定與掉落物抽取
 */
export async function handleChestOpen(userId: string, entityId: string, skipMimic = false, forceMimic = false) {
    const supabase = createClient(supabaseUrl, supabaseActionKey);

    // 1. 讀取用戶資料
    const { data: user, error: userErr } = await supabase
        .from('CharacterStats')
        .select('*')
        .eq('UserID', userId)
        .single();
    if (userErr || !user) throw new Error("用戶資料讀取失敗");

    // 1b. IsBlessed：黃金骰子加持，跳過 Mimic 並保證最高獎勵
    if (user.IsBlessed) {
        const newDice = (user.EnergyDice || 0) + 3;
        await supabase.from('CharacterStats')
            .update({ EnergyDice: newDice, IsBlessed: false })
            .eq('UserID', userId);
        await supabase.from('MapEntities').delete().eq('id', entityId);
        return { success: true, message: '✨ 黃金光輝護體！無視寶箱怪並獲得最豐厚獎勵！獲得 +3 能源骰子。', lootDice: 3, isMimic: false };
    }

    // 2. 判定是否為寶箱怪 (Mimic)
    // i2 火眼金睛：skipMimic=true 直接跳過；d6 貪狼之爪：forceMimic=true 強制觸發
    const isMimic = forceMimic ? true : (!skipMimic && Math.random() < MIMIC_CHANCE);
    let message = "";
    let lootDice = 0;
    let lootGoldenDice = 0;

    if (isMimic) {
        // 進行「慧根 (Savvy)」檢定 (DC 12)
        const roll = Math.floor(Math.random() * 20) + 1;
        const checkValue = roll + (user.Savvy || 0);

        if (checkValue < 12) {
            // 檢定失敗
            if (forceMimic) {
                // d6 貪狼之爪：失敗 → +2 黃金骰（不扣能源骰子）
                lootGoldenDice = 2;
                const newGolden = (user.GoldenDice || 0) + lootGoldenDice;
                await supabase.from('CharacterStats').update({ GoldenDice: newGolden }).eq('UserID', userId);
                message = `！寶箱怪發動！貪狼之爪雖識破失敗 (骰出 ${roll} + 慧根 ${user.Savvy} < 12)，但獲得 +2 黃金骰作為補償！`;
            } else {
                const newDice = Math.max(0, (user.EnergyDice || 0) - 1);
                await supabase.from('CharacterStats').update({ EnergyDice: newDice }).eq('UserID', userId);
                message = `糟糕！是寶箱怪！檢定失敗 (骰出 ${roll} + 慧根 ${user.Savvy} < 12)，你失去了 1 個能源骰子。`;
            }
        } else {
            // 檢定成功
            if (forceMimic) {
                // d6 貪狼之爪：成功 → +3 黃金骰
                lootGoldenDice = 3;
                const newGolden = (user.GoldenDice || 0) + lootGoldenDice;
                await supabase.from('CharacterStats').update({ GoldenDice: newGolden }).eq('UserID', userId);
                message = `貪狼之爪大成功！識破寶箱怪 (骰出 ${roll} + 慧根 ${user.Savvy} >= 12)，獲得 +3 黃金骰！`;
            } else {
                lootDice = 1;
                const newDice = (user.EnergyDice || 0) + lootDice;
                await supabase.from('CharacterStats').update({ EnergyDice: newDice }).eq('UserID', userId);
                message = `警覺！你識破了寶箱怪的偽裝 (骰出 ${roll} + 慧根 ${user.Savvy} >= 12)，反手搜刮了 1 個能源骰子！`;
            }
        }
    } else {
        // 正常抽取掉落物
        const rand = Math.random() * 100;
        let cumulative = 0;
        for (const item of CHEST_LOOT_TABLE) {
            cumulative += item.weight;
            if (rand <= cumulative) {
                lootDice = item.dice;
                break;
            }
        }
        
        const newDice = (user.EnergyDice || 0) + lootDice;
        await supabase.from('CharacterStats').update({ EnergyDice: newDice }).eq('UserID', userId);
        message = `打開寶箱！你獲得了 ${lootDice} 個能源骰子。`;
    }

    // 3. 移除地圖上的箱子實體
    await supabase.from('MapEntities').delete().eq('id', entityId);

    return {
        success: true,
        message,
        lootDice,
        lootGoldenDice,
        isMimic
    };
}

/**
 * d5 業火之種陷阱觸發
 * 當玩家移動到含有 trap entity 的格子且同格有怪物時呼叫。
 * 對怪物造成 level × 50 真實傷害（穿透防禦）。
 */
export async function applyTrapDamage(trapEntityId: string, monsterEntityId: string): Promise<{
    success: boolean; killed: boolean; message: string;
}> {
    const supabase = createClient(supabaseUrl, supabaseActionKey);

    // 讀取陷阱資料（含 TTL 檢查）
    const { data: trap } = await supabase
        .from('MapEntities').select('*').eq('id', trapEntityId).single();
    if (!trap) return { success: false, killed: false, message: '陷阱實體不存在' };

    const expiresAt = trap.data?.expiresAt;
    if (expiresAt && new Date(expiresAt) < new Date()) {
        // 陷阱已過期，僅清除
        await supabase.from('MapEntities').delete().eq('id', trapEntityId);
        return { success: false, killed: false, message: '業火之種已熄滅（超過 72 小時）' };
    }

    // 讀取怪物資料
    const { data: monster } = await supabase
        .from('MapEntities').select('*').eq('id', monsterEntityId).single();
    if (!monster) {
        await supabase.from('MapEntities').delete().eq('id', trapEntityId);
        return { success: false, killed: false, message: '怪物實體不存在' };
    }

    const monsterLevel = monster.data?.level || 1;
    const trapDamage = monsterLevel * (trap.data?.trapDamageBase || 50);
    const currentHP = monster.data?.hp ?? (50 + monsterLevel * 15);
    const newHP = currentHP - trapDamage;

    // 移除陷阱
    await supabase.from('MapEntities').delete().eq('id', trapEntityId);

    if (newHP <= 0) {
        // 怪物被一擊消滅
        await supabase.from('MapEntities').delete().eq('id', monsterEntityId);
        return { success: true, killed: true, message: `業火之種引爆！對 Lv.${monsterLevel} 怪物造成 ${trapDamage} 真實傷害，直接消滅！` };
    } else {
        // 怪物殘血
        await supabase.from('MapEntities')
            .update({ data: { ...monster.data, hp: newHP } })
            .eq('id', monsterEntityId);
        return { success: true, killed: false, message: `業火之種引爆！對 Lv.${monsterLevel} 怪物造成 ${trapDamage} 真實傷害（剩餘 HP: ${newHP}）。` };
    }
}

/**
 * 偽裝寶箱地形（mimic terrain）觸發的慧根檢定
 * DC 12：成功 +1 骰子，失敗 -1 骰子。每次踏入皆觸發，無冷卻。
 */
export async function handleMimicTerrain(userId: string): Promise<{
    success: boolean; gained: number; message: string;
}> {
    const supabase = createClient(supabaseUrl, supabaseActionKey);
    const { data: user } = await supabase
        .from('CharacterStats')
        .select('EnergyDice, Savvy')
        .eq('UserID', userId)
        .single();
    if (!user) return { success: false, gained: 0, message: '資料讀取失敗' };

    const roll = Math.floor(Math.random() * 20) + 1;
    const savvy = user.Savvy ?? 0;
    const total = roll + savvy;
    const pass = total >= 12;
    const delta = pass ? 1 : -1;
    const newDice = Math.max(0, (user.EnergyDice ?? 0) + delta);

    await supabase
        .from('CharacterStats')
        .update({ EnergyDice: newDice })
        .eq('UserID', userId);

    const msg = pass
        ? `識破偽裝寶箱！（骰出 ${roll} + 慧根 ${savvy} = ${total} ≥ 12）反手獲得 1 顆能量骰子！`
        : `上當了！（骰出 ${roll} + 慧根 ${savvy} = ${total} < 12）失去 1 顆能量骰子。`;

    return { success: true, gained: delta, message: msg };
}
