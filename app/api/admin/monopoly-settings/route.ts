import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SETTING_KEY = 'MonopolySettings';

export async function GET() {
    try {
        const { data } = await supabase
            .from('SystemSettings')
            .select('SettingValue')
            .eq('SettingName', SETTING_KEY)
            .single();

        if (data?.SettingValue) {
            return NextResponse.json({ settings: JSON.parse(data.SettingValue) });
        }
        return NextResponse.json({ settings: null });
    } catch {
        return NextResponse.json({ settings: null });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { settings } = await request.json();

        await supabase
            .from('SystemSettings')
            .upsert({
                SettingName: SETTING_KEY,
                SettingValue: JSON.stringify(settings),
            }, { onConflict: 'SettingName' });

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }
}
