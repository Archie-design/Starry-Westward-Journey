"use server";

import { createClient } from '@supabase/supabase-js';
import { IN_GAME_ITEMS, ROLE_CURE_MAP } from '@/lib/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseActionKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseActionKey);

// 六維屬性列表
const SIX_STATS = ['Spirit', 'Physique', 'Charisma', 'Savvy', 'Luck', 'Potential'] as const;

/**
 * Buy an item from the NPC Shop
 */
export async function buyGameItem(userId: string, itemId: string, cost: number) {
    if (!userId || !itemId || cost < 0) throw new Error("無效的購買請求");

    const targetItem = IN_GAME_ITEMS.find(i => i.id === itemId);
    if (!targetItem) throw new Error("找不到該道具");
    if (targetItem.price !== cost) throw new Error("價格不符");

    const { data: user, error: fetchErr } = await supabase
        .from('CharacterStats')
        .select('GameGold, GameInventory')
        .eq('UserID', userId)
        .single();

    if (fetchErr || !user) throw new Error("無法獲取玩家資料");

    const currentGold = user.GameGold || 0;
    if (currentGold < cost) throw new Error("金幣不足");

    const currentInv = user.GameInventory || [];
    const itemIdx = currentInv.findIndex((i: any) => i.id === itemId);

    if (itemIdx >= 0) {
        currentInv[itemIdx].count += 1;
    } else {
        currentInv.push({ id: itemId, count: 1 });
    }

    const { error: updateErr } = await supabase
        .from('CharacterStats')
        .update({
            GameGold: currentGold - cost,
            GameInventory: currentInv
        })
        .eq('UserID', userId);

    if (updateErr) throw new Error("交易失敗：" + updateErr.message);

    return { success: true, message: `成功購買了 ${targetItem.name}！` };
}

/**
 * Use an item from the Inventory.
 * - i8 / i10: applies DB-side stat changes directly.
 * - All others: deducts item and returns { itemEffect } for the frontend to apply.
 */
export async function useGameItem(userId: string, itemId: string) {
    if (!userId || !itemId) throw new Error("無效的使用請求");

    const targetItem = IN_GAME_ITEMS.find(i => i.id === itemId);
    if (!targetItem) throw new Error("找不到該道具");

    const { data: user, error: fetchErr } = await supabase
        .from('CharacterStats')
        .select('GameInventory, HP, MaxHP, Role, Spirit, Physique, Charisma, Savvy, Luck, Potential')
        .eq('UserID', userId)
        .single();

    if (fetchErr || !user) throw new Error("無法獲取玩家資料");

    const currentInv = user.GameInventory || [];
    const itemIdx = currentInv.findIndex((i: any) => i.id === itemId);

    if (itemIdx < 0 || currentInv[itemIdx].count <= 0) {
        throw new Error("背包裡沒有這個道具了！");
    }

    // Deduct item
    currentInv[itemIdx].count -= 1;
    if (currentInv[itemIdx].count === 0) {
        currentInv.splice(itemIdx, 1);
    }

    // Build DB update patch (always includes GameInventory deduction)
    const patch: Record<string, any> = { GameInventory: currentInv };
    let resultMsg = `使用了 ${targetItem.name}！`;
    let itemEffect: Record<string, any> | null = null;

    if (itemId === 'i8') {
        // 觀音甘露水：回復 30% MaxHP，不超過上限
        const roleConfig = ROLE_CURE_MAP[user.Role] || ROLE_CURE_MAP['孫悟空'];
        const maxHP = user.MaxHP ?? (roleConfig.baseHP + (user.Physique ?? 0) * roleConfig.hpScale);
        const currentHP = user.HP ?? maxHP;
        const restored = Math.floor(maxHP * 0.3);
        const newHP = Math.min(maxHP, currentHP + restored);
        patch.HP = newHP;
        resultMsg = `使用了 ${targetItem.name}！恢復了 ${restored} HP（${currentHP} → ${newHP}）。`;

    } else if (itemId === 'i10') {
        // 人參果：永久提升最低六維屬性 +1
        const statValues = SIX_STATS.map(s => ({ stat: s, val: (user[s] as number) ?? 0 }));
        const lowest = statValues.reduce((min, cur) => cur.val < min.val ? cur : min);
        patch[lowest.stat] = lowest.val + 1;
        resultMsg = `使用了 ${targetItem.name}！${lowest.stat} 永久提升 1 點（${lowest.val} → ${lowest.val + 1}）。`;

    } else {
        // 其餘道具效果由前端/地圖/戰鬥系統處理，回傳 itemEffect 類型
        const effectMap: Record<string, { type: string; desc: string }> = {
            i1: { type: 'combat_instant_kill', desc: '收妖小葫蘆：對低階心魔怪使用，直接收服並獲取掉落物。' },
            i2: { type: 'reveal_fog_mimic',    desc: '火眼金睛：破除 3 格內的迷霧，識破偽裝寶箱真面目。' },
            i3: { type: 'death_shield',        desc: '錦鑭袈裟：下次致死傷害保留 1 HP（本場戰鬥有效）。' },
            i4: { type: 'seal_passive',        desc: '如意金剛琢：封印目標怪物被動技能 2 回合。' },
            i5: { type: 'ignore_terrain',      desc: '步雲履：本回合無視地形移動懲罰。' },
            i6: { type: 'scatter_or_push',     desc: '芭蕉扇：吹散沙塵暴地形，或將直線怪物擊退 3 格。' },
            i7: { type: 'dice_double',         desc: '神行甲馬：本回合擲骰結果直接乘 2。' },
            i9: { type: 'combat_all_stats_50', desc: '九轉金丹：本場戰鬥全屬性 +50%。' },
        };
        itemEffect = effectMap[itemId] ?? { type: itemId, desc: targetItem.desc };
        resultMsg = `使用了 ${targetItem.name}！${itemEffect.desc}`;
    }

    const { error: updateErr } = await supabase
        .from('CharacterStats')
        .update(patch)
        .eq('UserID', userId);

    if (updateErr) throw new Error("使用失敗：" + updateErr.message);

    return { success: true, message: resultMsg, itemEffect };
}
