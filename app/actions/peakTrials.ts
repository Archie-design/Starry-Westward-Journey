'use server';

import { createClient } from '@supabase/supabase-js';
import type { PeakTrial, PeakTrialRegistration } from '@/types';

const _url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const _key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function getPeakTrialsForPlayer(userId: string): Promise<{
    trials: PeakTrial[];
    myRegistrations: PeakTrialRegistration[];
}> {
    const supabase = createClient(_url, _key);

    const [trialsRes, regsRes] = await Promise.all([
        supabase
            .from('PeakTrialsWithCount')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
        supabase
            .from('PeakTrialRegistrations')
            .select('*')
            .eq('user_id', userId),
    ]);

    return {
        trials: (trialsRes.data || []) as PeakTrial[],
        myRegistrations: (regsRes.data || []) as PeakTrialRegistration[],
    };
}

export async function registerForPeakTrial(
    trialId: string,
    userId: string,
    userName: string,
    squadName?: string,
    battalionName?: string,
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient(_url, _key);

    // Check capacity
    const { data: trial } = await supabase
        .from('PeakTrialsWithCount')
        .select('max_participants, registration_count')
        .eq('id', trialId)
        .single();

    if (trial?.max_participants && (trial.registration_count ?? 0) >= trial.max_participants) {
        return { success: false, error: '名額已滿' };
    }

    const { error } = await supabase
        .from('PeakTrialRegistrations')
        .insert({
            trial_id: trialId,
            user_id: userId,
            user_name: userName,
            squad_name: squadName ?? null,
            battalion_name: battalionName ?? null,
        });

    if (error) {
        if (error.code === '23505') return { success: false, error: '您已報名此試煉' };
        return { success: false, error: error.message };
    }
    return { success: true };
}

export async function cancelPeakTrialRegistration(
    trialId: string,
    userId: string,
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient(_url, _key);

    const { error } = await supabase
        .from('PeakTrialRegistrations')
        .delete()
        .eq('trial_id', trialId)
        .eq('user_id', userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * 大隊長掃碼後呼叫，標記玩家出席
 * QR Code 內容為 PeakTrialRegistrations.id（UUID）
 */
export async function markPeakTrialAttendance(registrationId: string): Promise<{
    success: boolean;
    alreadyAttended?: boolean;
    userName?: string;
    trialTitle?: string;
    error?: string;
}> {
    const supabase = createClient(_url, _key);

    // 查詢報名記錄
    const { data: reg, error: fetchErr } = await supabase
        .from('PeakTrialRegistrations')
        .select('id, trial_id, user_id, user_name, attended')
        .eq('id', registrationId)
        .single();

    if (fetchErr || !reg) {
        return { success: false, error: '找不到對應的報名記錄，請確認 QR Code 是否正確。' };
    }

    // 讀取試煉標題（供確認訊息使用）
    const { data: trial } = await supabase
        .from('PeakTrials')
        .select('title')
        .eq('id', reg.trial_id)
        .single();

    if (reg.attended) {
        return {
            success: true,
            alreadyAttended: true,
            userName: reg.user_name ?? reg.user_id,
            trialTitle: trial?.title,
        };
    }

    const { error: updateErr } = await supabase
        .from('PeakTrialRegistrations')
        .update({ attended: true })
        .eq('id', registrationId);

    if (updateErr) return { success: false, error: updateErr.message };

    return {
        success: true,
        alreadyAttended: false,
        userName: reg.user_name ?? reg.user_id,
        trialTitle: trial?.title,
    };
}

/**
 * 取得某場試煉的出席名單（大隊長掃碼介面使用）
 */
export async function getPeakTrialAttendanceList(trialId: string): Promise<PeakTrialRegistration[]> {
    const supabase = createClient(_url, _key);
    const { data } = await supabase
        .from('PeakTrialRegistrations')
        .select('*')
        .eq('trial_id', trialId)
        .eq('attended', true)
        .order('registered_at', { ascending: true });
    return (data || []) as PeakTrialRegistration[];
}
