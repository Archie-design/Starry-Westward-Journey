"use server";

import { createClient } from "@supabase/supabase-js";
import { CHEST_LOOT_TABLE, MIMIC_CHANCE } from "@/lib/constants";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseActionKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * 處理開箱子邏輯
 * 包含寶箱怪檢定與掉落物抽取
 */
export async function handleChestOpen(userId: string, entityId: string) {
    const supabase = createClient(supabaseUrl, supabaseActionKey);

    // 1. 讀取用戶資料
    const { data: user, error: userErr } = await supabase
        .from('CharacterStats')
        .select('*')
        .eq('UserID', userId)
        .single();
    if (userErr || !user) throw new Error("用戶資料讀取失敗");

    // 2. 判定是否為寶箱怪 (Mimic)
    const isMimic = Math.random() < MIMIC_CHANCE;
    let message = "";
    let lootDice = 0;

    if (isMimic) {
        // 進行「慧根 (Savvy)」檢定 (DC 12)
        const roll = Math.floor(Math.random() * 20) + 1;
        const checkValue = roll + (user.Savvy || 0);
        
        if (checkValue < 18) {
            // 檢定失敗：扣除骰子
            const loss = 1;
            const newDice = Math.max(0, (user.EnergyDice || 0) - loss);
            await supabase.from('CharacterStats').update({ EnergyDice: newDice }).eq('UserID', userId);
            message = `糟糕！是寶箱怪！檢定失敗 (骰出 ${roll} + 慧根 ${user.Savvy} < 18)，你失去了 1 個能源骰子。`;
        } else {
            // 檢定成功：識破並反擊獲得保底獎勵
            lootDice = 1;
            const newDice = (user.EnergyDice || 0) + lootDice;
            await supabase.from('CharacterStats').update({ EnergyDice: newDice }).eq('UserID', userId);
            message = `警覺！你識破了寶箱怪的偽裝 (骰出 ${roll} + 慧根 ${user.Savvy} >= 18)，反手搜刮了 1 個能源骰子！`;
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
        isMimic 
    };
}
