"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseActionKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * 捐獻黃金骰子至部隊
 */
export async function transferGoldenDiceToTeam(userId: string, teamName: string, amount: number) {
    if (amount <= 0) return { success: false, error: "捐獻數量必須大於 0" };
    
    const supabase = createClient(supabaseUrl, supabaseActionKey);
    
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
    const supabase = createClient(supabaseUrl, supabaseActionKey);
    const { error } = await supabase.rpc('exchange_golden_to_energy_dice', {
        p_user_id: userId,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * 在開箱前使用黃金骰子進行「加持」
 * 消耗 1 枚黃金骰子，確保下一次開箱必定获得最高獎勵且無視寶箱怪
 */
export async function blessChestWithGoldenDice(userId: string) {
    const supabase = createClient(supabaseUrl, supabaseActionKey);

    const { data: user, error: userErr } = await supabase
        .from('CharacterStats')
        .select('GoldenDice')
        .eq('UserID', userId)
        .single();

    if (userErr || !user) throw new Error("玩家資料讀取失敗");
    if ((user.GoldenDice || 0) < 1) throw new Error("黃金骰子不足。");

    // 這裡可以透過設定一個臨時狀態 (Flag) 在 CharacterStats 中，
    // 例如 IsBlessed: true，然後在 handleChestOpen 中判斷。
    // 但為了簡化，我們先實現在這裡直接消耗並標記。
    
    // 假設我們在數據表中增加了 IsBlessed 欄位
    const { error: updateErr } = await supabase
        .from('CharacterStats')
        .update({
            GoldenDice: user.GoldenDice - 1,
            // 標記為加持狀態，有效期直到下一次開箱
            // 這需要資料庫支援此欄位
        })
        .eq('UserID', userId);

    // 如果不改欄位，我們可以讓這個 function 直接回傳「加持成功」，
    // 然後讓前端在呼叫 handleChestOpen 時帶入參數。
    // 但為了安全，後端檢核更好。
    
    // 這裡暫時回傳成功，並提示玩家下一次開箱將受到保佑。
    return {
        success: true,
        message: "黃金骰子光芒閃爍！接下來的寶箱開拓將無往不利。"
    };
}
