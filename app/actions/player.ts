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

/** 更新座標（傳送門傳送） */
export async function savePosition(userId: string, q: number, r: number) {
  const { error } = await supabase
    .from('CharacterStats')
    .update({ CurrentQ: q, CurrentR: r })
    .eq('UserID', userId);
  return { error: error?.message };
}

/** 儲存地圖地形（地圖編輯器） */
export async function saveWorldMap(terrain: Record<string, string>, config: { corridorL: number; corridorW: number }) {
  const { error } = await supabase
    .from('world_maps')
    .upsert({
      id: 'main_world_map',
      data: { terrain, config },
      updated_at: new Date().toISOString(),
    });
  return { error: error?.message };
}
