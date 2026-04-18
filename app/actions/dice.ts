"use server";

import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * 捐獻黃金骰子至部隊
 */
export async function transferGoldenDiceToTeam(userId: string, teamName: string, amount: number) {
    if (amount <= 0) return { success: false, error: "捐獻數量必須大於 0" };
    
    const supabase = supabaseAdmin;
    
    const { data, error } = await supabase.rpc('transfer_golden_dice', {
        p_from_user: userId,
        p_amount: amount
    });

    if (error) return { success: false, error: error.message };
    
    return { success: true };
}

/**
 * 兌換：消耗 1 黃金骰子，獲得 3 能源骰子（上限 100）
 */
export async function exchangeGoldenDiceToEnergy(userId: string) {
    const supabase = supabaseAdmin;
    const { error } = await supabase.rpc('exchange_golden_to_energy_dice', {
        p_user_id: userId,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * 在開箱前使用黃金骰子進行「加持」
 * 消耗 1 枚黃金骰子，設定 IsBlessed = true，下次 handleChestOpen 保證最高獎勵且無視寶箱怪
 */
export async function blessChestWithGoldenDice(userId: string) {
    const supabase = supabaseAdmin;

    const { data: user, error: userErr } = await supabase
        .from('CharacterStats')
        .select('GoldenDice, IsBlessed')
        .eq('UserID', userId)
        .single();

    if (userErr || !user) throw new Error("玩家資料讀取失敗");
    if ((user.GoldenDice || 0) < 1) throw new Error("黃金骰子不足。");
    if (user.IsBlessed) return { success: true, message: "已有黃金護體！開箱時將無視寶箱怪並獲最高獎勵。" };

    const { error: updateErr } = await supabase
        .from('CharacterStats')
        .update({ GoldenDice: user.GoldenDice - 1, IsBlessed: true })
        .eq('UserID', userId);

    if (updateErr) throw new Error("加持失敗：" + updateErr.message);

    return { success: true, message: "黃金光輝護體！下次開箱將無視寶箱怪並獲得最豐厚獎勵 +3 骰！" };
}
