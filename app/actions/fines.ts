'use server';

import { createClient } from '@supabase/supabase-js';
import { logAdminAction } from './admin';

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// ── 1. 查詢小隊所有成員罰款狀態 ─────────────────────────────────
export async function getSquadFineStatus(captainUserId: string) {
    const supabase = getServiceClient();

    const { data: captain } = await supabase
        .from('CharacterStats')
        .select('TeamName, IsCaptain')
        .eq('UserID', captainUserId)
        .single();

    if (!captain?.IsCaptain) return { success: false, error: '僅限小隊長使用此功能' };

    const { data: members, error } = await supabase
        .from('CharacterStats')
        .select('UserID, Name, TotalFines, FinePaid')
        .eq('TeamName', captain.TeamName)
        .order('Name');

    if (error) return { success: false, error: error.message };

    return {
        success: true,
        squadName: captain.TeamName,
        members: (members ?? []).map((m: any) => ({
            userId:     m.UserID,
            name:       m.Name,
            totalFines: m.TotalFines ?? 0,
            finePaid:   m.FinePaid ?? 0,
            balance:    Math.max(0, (m.TotalFines ?? 0) - (m.FinePaid ?? 0)),
        })),
    };
}

// ── 2. 記錄隊員繳款 ──────────────────────────────────────────────
export async function recordFinePayment(
    captainUserId: string,
    targetUserId: string,
    amount: number,
    periodLabel: string,
    paidToCaptainAt?: string,
) {
    if (amount <= 0) return { success: false, error: '金額必須大於 0' };

    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc('record_fine_payment', {
        p_captain_id:         captainUserId,
        p_target_id:          targetUserId,
        p_amount:             amount,
        p_period_label:       periodLabel,
        p_paid_to_captain_at: paidToCaptainAt ?? null,
    });

    if (error) return { success: false, error: error.message };
    if (!data.success) return { success: false, error: data.error };

    // Get target name for log (best-effort)
    const { data: target } = await supabase
        .from('CharacterStats')
        .select('Name')
        .eq('UserID', targetUserId)
        .single();

    await logAdminAction('fine_payment', captainUserId, targetUserId, target?.Name, {
        amount, periodLabel, paidToCaptainAt,
    });

    return { success: true, paymentId: data.paymentId };
}

// ── 3. 更新「隊員交款給小隊長」日期 ──────────────────────────────
export async function setPaidToCaptainDate(
    captainUserId: string,
    paymentId: string,
    date: string,
) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, error: '日期格式錯誤，請使用 YYYY-MM-DD' };

    const supabase = getServiceClient();

    const { data: captain } = await supabase
        .from('CharacterStats')
        .select('TeamName, IsCaptain')
        .eq('UserID', captainUserId)
        .single();

    if (!captain?.IsCaptain) return { success: false, error: '僅限小隊長使用' };

    const { data, error } = await supabase
        .from('FinePayments')
        .update({ paid_to_captain_at: date })
        .eq('id', paymentId)
        .eq('squad_name', captain.TeamName)
        .select('id');

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: '找不到該繳款紀錄或不屬於本小隊' };

    return { success: true };
}

// ── 4. 更新「小隊長上繳大會」日期 ────────────────────────────────
export async function setSubmittedToOrgDate(
    captainUserId: string,
    paymentId: string,
    date: string,
) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, error: '日期格式錯誤，請使用 YYYY-MM-DD' };

    const supabase = getServiceClient();

    const { data: captain } = await supabase
        .from('CharacterStats')
        .select('TeamName, IsCaptain')
        .eq('UserID', captainUserId)
        .single();

    if (!captain?.IsCaptain) return { success: false, error: '僅限小隊長使用' };

    const { data, error } = await supabase
        .from('FinePayments')
        .update({ submitted_to_org_at: date })
        .eq('id', paymentId)
        .eq('squad_name', captain.TeamName)
        .select('id');

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: '找不到該繳款紀錄或不屬於本小隊' };

    await logAdminAction('fine_submitted_to_org', captainUserId, paymentId, undefined, { date });
    return { success: true };
}

// ── 5. 小隊長觸發上週 w3 違規結算 ────────────────────────────────
export async function checkSquadW3Compliance(
    captainUserId: string,
    mondayISO?: string,
) {
    // Calculate week range in JS (same logic as before)
    let weekStart: Date;
    if (mondayISO) {
        weekStart = new Date(mondayISO + 'T00:00:00+08:00');
    } else {
        const nowTW = new Date(Date.now() + 8 * 3600 * 1000);
        const day = nowTW.getUTCDay() || 7;
        const thisMonday = new Date(nowTW);
        thisMonday.setUTCDate(nowTW.getUTCDate() - (day - 1));
        thisMonday.setUTCHours(0, 0, 0, 0);
        weekStart = new Date(thisMonday);
        weekStart.setUTCDate(thisMonday.getUTCDate() - 7);
    }
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
    const periodLabel = weekStart.toISOString().slice(0, 10);

    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc('check_squad_w3_compliance', {
        p_captain_id:   captainUserId,
        p_week_start:   weekStart.toISOString(),
        p_week_end:     weekEnd.toISOString(),
        p_period_label: periodLabel,
    });

    if (error) return { success: false, error: error.message };
    if (!data.success) return { success: false, error: data.error };
    if (data.alreadyRun) return { success: true, alreadyRun: true, periodLabel };

    await logAdminAction('w3_compliance', captainUserId, undefined, `${periodLabel}|${data.teamName}`, {
        teamName:      data.teamName,
        periodLabel,
        violatorCount: data.violators?.length ?? 0,
        violators:     (data.violators ?? []).map((v: any) => v.name),
    });

    return { success: true, alreadyRun: false, periodLabel, violators: data.violators ?? [] };
}

// ── 6. 記錄小隊長批次上繳大會 ─────────────────────────────────────
export async function recordOrgSubmission(
    captainUserId: string,
    amount: number,
    submittedAt: string,
    notes?: string,
) {
    if (amount <= 0) return { success: false, error: '金額必須大於 0' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(submittedAt)) return { success: false, error: '日期格式錯誤，請使用 YYYY-MM-DD' };

    const supabase = getServiceClient();

    const { data: captain } = await supabase
        .from('CharacterStats')
        .select('TeamName, IsCaptain')
        .eq('UserID', captainUserId)
        .single();

    if (!captain?.IsCaptain) return { success: false, error: '僅限小隊長使用' };

    const { data, error } = await supabase
        .from('SquadFineSubmissions')
        .insert({
            squad_name:   captain.TeamName,
            amount,
            submitted_at: submittedAt,
            recorded_by:  captainUserId,
            notes:        notes ?? null,
        })
        .select('id')
        .single();

    if (error) return { success: false, error: error.message };

    await logAdminAction('fine_org_submission', captainUserId, undefined, captain.TeamName, { amount, submittedAt, notes });
    return { success: true, id: data.id };
}

// ── 7. 查詢小隊上繳大會紀錄 ──────────────────────────────────────
export async function getSquadOrgSubmissions(captainUserId: string) {
    const supabase = getServiceClient();

    const { data: captain } = await supabase
        .from('CharacterStats')
        .select('TeamName, IsCaptain')
        .eq('UserID', captainUserId)
        .single();

    if (!captain?.IsCaptain) return { success: false, error: '僅限小隊長使用' };

    const { data, error } = await supabase
        .from('SquadFineSubmissions')
        .select('id, squad_name, amount, submitted_at, recorded_by, notes, created_at')
        .eq('squad_name', captain.TeamName)
        .order('submitted_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, records: data ?? [] };
}

// ── 8. 查詢小隊歷史繳款紀錄 ──────────────────────────────────────
export async function getSquadFinePaymentHistory(captainUserId: string) {
    const supabase = getServiceClient();

    const { data: captain } = await supabase
        .from('CharacterStats')
        .select('TeamName, IsCaptain')
        .eq('UserID', captainUserId)
        .single();

    if (!captain?.IsCaptain) return { success: false, error: '僅限小隊長使用' };

    const { data, error } = await supabase
        .from('FinePayments')
        .select('id, user_id, user_name, amount, period_label, paid_to_captain_at, submitted_to_org_at, recorded_by, created_at')
        .eq('squad_name', captain.TeamName)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) return { success: false, error: error.message };
    return { success: true, squadName: captain.TeamName, records: data ?? [] };
}
