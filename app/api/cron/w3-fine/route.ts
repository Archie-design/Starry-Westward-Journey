import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkWeeklyW3Compliance } from '@/app/actions/admin';

// Called by Vercel Cron every Monday at 05:00 UTC (= 13:00 Taiwan time, 1h after auto-draw)
// vercel.json: { "crons": [{ "path": "/api/cron/w3-fine", "schedule": "0 5 * * 1" }] }
export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[cron/w3-fine] CRON_SECRET env var is not set.');
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Compute this Monday's period_label (same logic as checkWeeklyW3Compliance)
    const today = new Date();
    const day = today.getDay() || 7;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - (day - 1));
    thisMonday.setHours(0, 0, 0, 0);
    const weekStart = new Date(thisMonday);
    weekStart.setDate(thisMonday.getDate() - 14);
    const w2Start = new Date(weekStart);
    w2Start.setDate(w2Start.getDate() + 7);
    const periodLabel = `${weekStart.toISOString().slice(0, 10)}~${w2Start.toISOString().slice(0, 10)}`;

    // Idempotency check: skip if this period was already processed successfully
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: existing } = await supabase
        .from('AdminActivityLog')
        .select('id')
        .eq('action', 'w3_compliance')
        .eq('target_name', periodLabel)
        .eq('result', 'success')
        .limit(1);

    if (existing && existing.length > 0) {
        console.log(`[cron/w3-fine] Period ${periodLabel} already processed, skipping.`);
        return NextResponse.json({ skipped: true, periodLabel });
    }

    console.log(`[cron/w3-fine] Running w3 compliance for period: ${periodLabel}`);
    const result = await checkWeeklyW3Compliance();
    console.log('[cron/w3-fine] Completed:', JSON.stringify(result));
    return NextResponse.json(result);
}
