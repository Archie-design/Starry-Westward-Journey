'use server';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** 扣除能量骰子（擲骰後呼叫，絕對值寫入） */
export async function saveEnergyDice(userId: string, newCount: number) {
  const { error } = await supabase
    .from('CharacterStats')
    .update({ EnergyDice: newCount })
    .eq('UserID', userId);
  return { error: error?.message };
}

/** 更新 HP（噴泉回血、其他來源） */
export async function saveHP(userId: string, newHP: number) {
  const { error } = await supabase
    .from('CharacterStats')
    .update({ HP: newHP })
    .eq('UserID', userId);
  return { error: error?.message };
}
