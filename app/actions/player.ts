'use server';

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { checkMapAchievements } from '@/app/actions/achievements';
import { getLogicalDateStr } from '@/lib/utils/time';

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

/** 記錄移動格數，更新 TotalHexesMoved 並偵測地圖成就 */
export async function recordHexMove(userId: string, hexCount: number): Promise<{ newMapAchievements: string[] }> {
  const { data: user } = await supabase
    .from('CharacterStats')
    .select('TotalHexesMoved, Role')
    .eq('UserID', userId)
    .single();
  const uExt = user as any;
  const newTotal = (uExt?.TotalHexesMoved ?? 0) + hexCount;
  supabase.from('CharacterStats')
    .update({ TotalHexesMoved: newTotal })
    .eq('UserID', userId)
    .then(({ error }) => { if (error) console.error('[player] TotalHexesMoved update failed:', error.message); });
  const newMapAchievements = await checkMapAchievements(userId, {
    event: 'hex_moved',
    playerRole: uExt?.Role,
  });
  return { newMapAchievements };
}

/** 記錄孫悟空穿越黑曜石，更新 ObsidianPassages 並偵測地圖成就 */
export async function recordObsidianPassage(userId: string): Promise<{ newMapAchievements: string[] }> {
  const { data: user } = await supabase
    .from('CharacterStats')
    .select('ObsidianPassages')
    .eq('UserID', userId)
    .single();
  const uExt = user as any;
  supabase.from('CharacterStats')
    .update({ ObsidianPassages: (uExt?.ObsidianPassages ?? 0) + 1 })
    .eq('UserID', userId)
    .then(({ error }) => { if (error) console.error('[player] ObsidianPassages update failed:', error.message); });
  const newMapAchievements = await checkMapAchievements(userId, {
    event: 'obsidian_passage',
    playerRole: '孫悟空',
  });
  return { newMapAchievements };
}

/** 記錄迷霧陷阱觸發日期（用於 fog_survivor 成就：觸發後當日成功擊殺） */
export async function recordFogTrap(userId: string): Promise<void> {
  const today = getLogicalDateStr();
  await supabase.from('CharacterStats')
    .update({ FogTrapDate: today })
    .eq('UserID', userId);
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
