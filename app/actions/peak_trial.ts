'use server';

import { createClient } from '@supabase/supabase-js';
import type { PeakTrial, PeakTrialRegistration, PeakTrialReview } from '@/types';

const _url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const _key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function listPeakTrials() {
    const supabase = createClient(_url, _key);
    const { data, error } = await supabase
        .from('PeakTrials')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message, trials: [] };
    return { success: true, trials: (data || []) as PeakTrial[] };
}

export async function upsertPeakTrial(trial: Partial<PeakTrial> & { title: string }) {
    const supabase = createClient(_url, _key);

    if (trial.id) {
        // Update
        const { error } = await supabase
            .from('PeakTrials')
            .update({
                title: trial.title,
                description: trial.description ?? null,
                start_date: trial.start_date ?? null,
                end_date: trial.end_date ?? null,
                max_participants: trial.max_participants ?? null,
                is_active: trial.is_active ?? true,
            })
            .eq('id', trial.id);
        if (error) return { success: false, error: error.message };
    } else {
        // Insert
        const { error } = await supabase
            .from('PeakTrials')
            .insert({
                title: trial.title,
                description: trial.description ?? null,
                start_date: trial.start_date ?? null,
                end_date: trial.end_date ?? null,
                max_participants: trial.max_participants ?? null,
                is_active: trial.is_active ?? true,
                created_by: trial.created_by ?? null,
            });
        if (error) return { success: false, error: error.message };
    }
    return { success: true };
}

export async function deletePeakTrial(id: string) {
    const supabase = createClient(_url, _key);
    const { error } = await supabase.from('PeakTrials').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function togglePeakTrialActive(id: string, is_active: boolean) {
    const supabase = createClient(_url, _key);
    const { error } = await supabase.from('PeakTrials').update({ is_active }).eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function listPeakTrialRegistrations(trialId: string) {
    const supabase = createClient(_url, _key);
    const { data: regs, error } = await supabase
        .from('PeakTrialRegistrations')
        .select('*')
        .eq('trial_id', trialId)
        .order('registered_at', { ascending: false });

    if (error) return { success: false, error: error.message, registrations: [] };

    // Join user info
    const userIds = (regs || []).map(r => r.user_id);
    const { data: users } = await supabase
        .from('CharacterStats')
        .select('UserID, Name, SquadName')
        .in('UserID', userIds.length > 0 ? userIds : ['__none__']);

    const userMap = new Map((users ?? []).map(u => [u.UserID, u]));

    const registrations: PeakTrialRegistration[] = (regs || []).map(r => ({
        id: r.id,
        trial_id: r.trial_id,
        user_id: r.user_id,
        user_name: userMap.get(r.user_id)?.Name ?? r.user_id,
        squad_name: userMap.get(r.user_id)?.SquadName ?? '',
        registered_at: r.registered_at,
    }));

    return { success: true, registrations };
}

export async function listPeakTrialReviews(trialId: string) {
    const supabase = createClient(_url, _key);

    // Get all registrations for this trial
    const { data: regs } = await supabase
        .from('PeakTrialRegistrations')
        .select('id, user_id')
        .eq('trial_id', trialId);

    if (!regs || regs.length === 0) return { success: true, reviews: [] };

    const regIds = regs.map(r => r.id);
    const { data: reviews, error } = await supabase
        .from('PeakTrialReviews')
        .select('*')
        .in('registration_id', regIds)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message, reviews: [] };

    // Join user info
    const regUserMap = new Map(regs.map(r => [r.id, r.user_id]));
    const userIds = [...new Set(regs.map(r => r.user_id))];
    const { data: users } = await supabase
        .from('CharacterStats')
        .select('UserID, Name')
        .in('UserID', userIds);

    const nameMap = new Map((users ?? []).map(u => [u.UserID, u.Name]));

    const enriched = (reviews || []).map(rv => ({
        ...rv,
        user_id: regUserMap.get(rv.registration_id) ?? '',
        user_name: nameMap.get(regUserMap.get(rv.registration_id) ?? '') ?? '',
    }));

    return { success: true, reviews: enriched as (PeakTrialReview & { user_id: string; user_name: string })[] };
}

export async function reviewPeakTrialSubmission(
    reviewId: string,
    status: 'approved' | 'rejected',
    reviewedBy: string,
    notes?: string
) {
    const supabase = createClient(_url, _key);
    const { error } = await supabase
        .from('PeakTrialReviews')
        .update({
            status,
            reviewed_by: reviewedBy,
            reviewed_at: new Date().toISOString(),
            notes: notes ?? null,
        })
        .eq('id', reviewId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}
