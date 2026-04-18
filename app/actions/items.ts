"use server";

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { IN_GAME_ITEMS, ROLE_CURE_MAP } from '@/lib/constants';

// 六維屬性列表
const SIX_STATS = ['Spirit', 'Physique', 'Charisma', 'Savvy', 'Luck', 'Potential'] as const;

/**
 * Buy an item from the NPC Shop
 */
export async function buyGameItem(userId: string, itemId: string, cost: number) {
    try {
        if (!userId || !itemId || cost < 0) return { success: false, error: "無效的購買請求" };

        const targetItem = IN_GAME_ITEMS.find(i => i.id === itemId);
        if (!targetItem) return { success: false, error: "找不到該道具" };
        if (targetItem.price !== cost) return { success: false, error: "價格不符" };

        const { data: user, error: fetchErr } = await supabase
            .from('CharacterStats')
            .select('GameGold, GameInventory')
            .eq('UserID', userId)
            .single();

        if (fetchErr || !user) return { success: false, error: "無法獲取玩家資料" };

        const currentGold = user.GameGold || 0;
        if (currentGold < cost) return { success: false, error: "靈石不足" };

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

        if (updateErr) return { success: false, error: "交易失敗：" + updateErr.message };

        return { success: true, message: `成功購買了 ${targetItem.name}！` };
    } catch (err: any) {
        return { success: false, error: err?.message ?? "購買發生未知錯誤" };
    }
}

/**
 * Use an item from the Inventory.
 * - i8 / i10: applies DB-side stat changes directly.
 * - All others: deducts item and returns { itemEffect } for the frontend to apply.
 */
export async function useGameItem(userId: string, itemId: string) {
    try {
        if (!userId || !itemId) return { success: false, error: "無效的使用請求" };

        const targetItem = IN_GAME_ITEMS.find(i => i.id === itemId);
        if (!targetItem) return { success: false, error: "找不到該道具" };

        const { data: user, error: fetchErr } = await supabase
            .from('CharacterStats')
            .select('GameInventory, HP, MaxHP, Role, Spirit, Physique, Charisma, Savvy, Luck, Potential, EnergyDice, CurrentQ, CurrentR, TeamName, DemonDropBoostSeasonal')
            .eq('UserID', userId)
            .single();

        if (fetchErr || !user) return { success: false, error: "無法獲取玩家資料" };

        const currentInv = user.GameInventory || [];
        const itemIdx = currentInv.findIndex((i: any) => i.id === itemId);

        if (itemIdx < 0 || currentInv[itemIdx].count <= 0) {
            return { success: false, error: "背包裡沒有這個道具了！" };
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
            // 觀音甘露水：回復 30% MaxHP，不超過上限；同時解除移動減益（深淵泥淖等）
            const roleConfig = ROLE_CURE_MAP[user.Role] || ROLE_CURE_MAP['孫悟空'];
            const maxHP = user.MaxHP ?? (roleConfig.baseHP + (user.Physique ?? 0) * roleConfig.hpScale);
            const currentHP = user.HP ?? maxHP;
            const restored = Math.floor(maxHP * 0.3);
            const newHP = Math.min(maxHP, currentHP + restored);
            patch.HP = newHP;
            itemEffect = { type: 'clear_movement_debuff' };
            resultMsg = `使用了 ${targetItem.name}！恢復了 ${restored} HP（${currentHP} → ${newHP}），並解除移動減益。`;

        } else if (itemId === 'i10') {
            // 人參果：永久提升最低六維屬性 +1
            const statValues = SIX_STATS.map(s => ({ stat: s, val: (user[s] as number) ?? 0 }));
            const lowest = statValues.reduce((min, cur) => cur.val < min.val ? cur : min);
            patch[lowest.stat] = lowest.val + 1;
            resultMsg = `使用了 ${targetItem.name}！${lowest.stat} 永久提升 1 點（${lowest.val} → ${lowest.val + 1}）。`;

        } else if (itemId === 'd3') {
            // 心魔殘骸：立刻 +2 EnergyDice + 本賽季心魔掉落率永久 +5%
            const newDice = (user.EnergyDice ?? 0) + 2;
            const newBoost = Math.round(((user.DemonDropBoostSeasonal ?? 0) + 0.05) * 1000) / 1000;
            patch.EnergyDice = newDice;
            patch.DemonDropBoostSeasonal = newBoost;
            resultMsg = `心魔殘骸消耗！獲得 +2 能源骰子，心魔怪掉落率永久 +5%（當前 +${Math.round(newBoost * 100)}%）。`;

        } else if (itemId === 'd4') {
            // 混沌碎片：服務端擲 d20，回傳 outcome
            const roll = Math.floor(Math.random() * 20) + 1;
            if (roll <= 5) {
                // 傳送：回傳 type，客戶端負責選目標格
                itemEffect = { type: 'd4_teleport', roll };
                resultMsg = `混沌碎片！骰出 ${roll}，空間錯位！即將傳送至隨機地格...`;
            } else if (roll <= 15) {
                // 清除當格所有怪物
                await supabase.from('MapEntities')
                    .delete()
                    .eq('q', user.CurrentQ ?? 0)
                    .eq('r', user.CurrentR ?? 0)
                    .eq('type', 'monster');
                itemEffect = { type: 'd4_clear', roll };
                resultMsg = `混沌碎片！骰出 ${roll}，業力風暴清除當格所有怪物！`;
            } else {
                // 開啟 NPC 商店
                itemEffect = { type: 'd4_shop', roll };
                resultMsg = `混沌碎片！骰出 ${roll}，稀有商人現身！`;
            }

        } else if (itemId === 'd5') {
            // 業火之種：在當前格插入 trap MapEntity（72hr TTL）
            const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
            const { error: trapErr } = await supabase.from('MapEntities').insert({
                q: user.CurrentQ ?? 0,
                r: user.CurrentR ?? 0,
                type: 'trap',
                name: '業火之種',
                icon: '🔥',
                owner_id: userId,
                data: { placedBy: userId, expiresAt, trapDamageBase: 50 },
                is_active: true,
            });
            if (trapErr) return { success: false, error: '陷阱埋設失敗：' + trapErr.message };
            resultMsg = `業火之種埋設！此格陷阱將在 72 小時內引爆首個到達的怪物（lv × 50 真實傷害）。`;

        } else if (itemId === 'd7') {
            // 渾天至寶珠：更新 TeamSettings.d7_activated_at
            if (!user.TeamName) {
                return { success: false, error: '未加入隊伍，無法啟動梵天庇護。' };
            }
            const { error: d7Err } = await supabase
                .from('TeamSettings')
                .update({ d7_activated_at: new Date().toISOString() })
                .eq('team_name', user.TeamName);
            if (d7Err) return { success: false, error: '梵天庇護啟動失敗：' + d7Err.message };
            resultMsg = `🌟 渾天至寶珠啟動！全隊 2 天「梵天庇護」開始：定課修為 ×2、五毒詛咒免疫、戰敗零懲罰！`;

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

        if (updateErr) return { success: false, error: "使用失敗：" + updateErr.message };

        return { success: true, message: resultMsg, itemEffect };
    } catch (err: any) {
        return { success: false, error: err?.message ?? "使用道具發生未知錯誤" };
    }
}

/**
 * Push a monster 3 hexes in the fan direction (i6 芭蕉扇)
 */
export async function pushMonsterByFan(userId: string, entityId: string, newQ: number, newR: number) {
    try {
        if (!userId || !entityId) return { success: false, error: '無效的請求' };
        const { data: entity, error: fetchErr } = await supabase
            .from('MapEntities')
            .select('id, type')
            .eq('id', entityId)
            .eq('type', 'monster')
            .single();
        if (fetchErr || !entity) return { success: false, error: '找不到目標怪物' };
        const { error: updateErr } = await supabase
            .from('MapEntities')
            .update({ q: newQ, r: newR })
            .eq('id', entityId);
        if (updateErr) return { success: false, error: '推移失敗：' + updateErr.message };
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message ?? '推移發生未知錯誤' };
    }
}
