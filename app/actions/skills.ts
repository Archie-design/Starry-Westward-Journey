'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseActionKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseActionKey);

/**
 * 筋斗雲（孫悟空 Streak ≥ 3）：記錄今日冷卻
 * 寫入 DailyLogs 一筆 QuestID='skill_jintoudun'，供前端 todayCompletedQuestIds 判斷禁用
 */
export async function recordSomersaultUsed(userId: string): Promise<void> {
    await supabase.from('DailyLogs').insert({
        UserID: userId,
        QuestID: 'skill_jintoudun',
        Timestamp: new Date().toISOString(),
    });
}

/**
 * 九齒釘耙（豬八戒 Streak ≥ 3）：強制開相鄰寶箱或挖空地
 * - entityId 非 null：刪除 MapEntity（寶箱）+ EnergyDice +1，必定成功
 * - entityId null：20% 機率 Coins +50
 */
export async function useNineToothRake(
    userId: string,
    entityId: string | null,
): Promise<{ success: boolean; type: 'chest' | 'ground'; gotDice?: boolean; coinAmount?: number; message: string }> {
    if (entityId) {
        // 強制開箱：刪除寶箱 + EnergyDice +1
        const { data: user } = await supabase
            .from('CharacterStats')
            .select('EnergyDice')
            .eq('UserID', userId)
            .single();

        const newDice = (user?.EnergyDice ?? 0) + 1;
        await Promise.all([
            supabase.from('MapEntities').delete().eq('id', entityId),
            supabase.from('CharacterStats').update({ EnergyDice: newDice }).eq('UserID', userId),
        ]);

        return { success: true, type: 'chest', gotDice: true, message: '九齒釘耙硬撬寶箱！獲得 1 能源骰子。' };
    } else {
        // 挖空地：20% 機率 Coins +50
        if (Math.random() < 0.2) {
            const { data: user } = await supabase
                .from('CharacterStats')
                .select('Coins')
                .eq('UserID', userId)
                .single();

            const newCoins = (user?.Coins ?? 0) + 50;
            await supabase.from('CharacterStats').update({ Coins: newCoins }).eq('UserID', userId);
            return { success: true, type: 'ground', coinAmount: 50, message: '九齒釘耙掘地！挖出 50 金幣。' };
        }
        return { success: true, type: 'ground', coinAmount: 0, message: '九齒釘耙掘地，一無所獲。' };
    }
}

/**
 * 龍騰（白龍馬 Streak ≥ 3）：將剩餘 AP 以 1:1 轉給任意隊友（EnergyDice）
 */
export async function dragonSoarDonate(
    fromUserId: string,
    toUserId: string,
    amount: number,
): Promise<{ success: boolean; error?: string }> {
    if (amount <= 0) return { success: false, error: '無剩餘 AP 可轉移。' };

    const { data: target } = await supabase
        .from('CharacterStats')
        .select('EnergyDice')
        .eq('UserID', toUserId)
        .single();

    if (!target) return { success: false, error: '找不到目標玩家。' };

    await supabase
        .from('CharacterStats')
        .update({ EnergyDice: (target.EnergyDice ?? 0) + amount })
        .eq('UserID', toUserId);

    return { success: true };
}

/**
 * 般若咒（唐三藏 Streak ≥ 3）：前方直線 3 格 AOE
 * - 對怪物造成 Spirit×10 真傷（低於此傷害則消滅）
 * - 對隊友回復等量 HP
 */
export async function usePrajnaMantra(
    userId: string,
    monsterEntityIds: string[],
    teammateUserIds: string[],
): Promise<{ success: boolean; monstersKilled: number; healAmount: number; message: string }> {
    const { data: caster } = await supabase
        .from('CharacterStats')
        .select('Spirit, Role, Level, Physique')
        .eq('UserID', userId)
        .single();

    if (!caster) return { success: false, monstersKilled: 0, healAmount: 0, message: '無法獲取玩家資料。' };

    const damage = (caster.Spirit ?? 1) * 10;
    let monstersKilled = 0;

    for (const entityId of monsterEntityIds) {
        const { data: entity } = await supabase
            .from('MapEntities')
            .select('data')
            .eq('id', entityId)
            .single();

        if (!entity) continue;
        const monsterHP = entity.data?.hp ?? (50 + (entity.data?.level ?? 1) * 15);
        if (monsterHP <= damage) {
            await supabase.from('MapEntities').delete().eq('id', entityId);
            monstersKilled++;
        } else {
            await supabase.from('MapEntities')
                .update({ data: { ...entity.data, hp: monsterHP - damage } })
                .eq('id', entityId);
        }
    }

    // 治療隊友
    const healAmount = damage;
    if (teammateUserIds.length > 0) {
        for (const uid of teammateUserIds) {
            const { data: teammate } = await supabase
                .from('CharacterStats')
                .select('HP, Physique')
                .eq('UserID', uid)
                .single();
            if (!teammate) continue;
            // 使用固定上限（200 + Physique × 20）作為 HP 天花板
            const maxHP = 200 + (teammate.Physique ?? 0) * 20;
            const newHP = Math.min(maxHP, (teammate.HP ?? maxHP) + healAmount);
            await supabase.from('CharacterStats').update({ HP: newHP }).eq('UserID', uid);
        }
    }

    let msg = `般若咒發動！造成 ${damage} 真傷`;
    if (monstersKilled > 0) msg += `，消滅 ${monstersKilled} 個妖怪`;
    if (teammateUserIds.length > 0) msg += `，治療 ${teammateUserIds.length} 位隊友 ${healAmount} HP`;
    msg += '。';

    return { success: true, monstersKilled, healAmount, message: msg };
}

/**
 * 拉一把（隊友助唐三藏）：贈送 1 顆 EnergyDice 給唐三藏隊友
 * 適用於唐三藏詛咒「寸步難行」需雙倍骰費時，隊友主動補給
 */
export async function pullTangSanzang(
    fromUserId: string,
    toUserId: string,
    amount: number = 1,
): Promise<{ success: boolean; error?: string }> {
    if (amount <= 0) return { success: false, error: '數量無效。' };

    const { data: from } = await supabase
        .from('CharacterStats')
        .select('EnergyDice')
        .eq('UserID', fromUserId)
        .single();

    if (!from || (from.EnergyDice ?? 0) < amount)
        return { success: false, error: '能量骰子不足。' };

    const { data: to } = await supabase
        .from('CharacterStats')
        .select('EnergyDice')
        .eq('UserID', toUserId)
        .single();

    if (!to) return { success: false, error: '找不到唐三藏。' };

    await Promise.all([
        supabase.from('CharacterStats').update({ EnergyDice: (from.EnergyDice ?? 0) - amount }).eq('UserID', fromUserId),
        supabase.from('CharacterStats').update({ EnergyDice: (to.EnergyDice ?? 0) + amount }).eq('UserID', toUserId),
    ]);

    return { success: true };
}
