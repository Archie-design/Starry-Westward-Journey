import { NextRequest, NextResponse } from 'next/server';

// Initiates LINE Login OAuth flow
// GET /api/auth/line?action=login
// GET /api/auth/line?action=bind&uid=USER_ID
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'login';
    const uid = searchParams.get('uid') || '';

    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!channelId) {
        return NextResponse.json({ error: 'LINE Login not configured' }, { status: 500 });
    }

    const redirectUri = `${appUrl}/api/auth/line/callback`;

    // Encode action and uid into state parameter
    // Support ?redirect=admin for admin page LINE verification
    const redirectParam = searchParams.get('redirect');
    const state = action === 'bind' && uid
        ? `bind:${uid}`
        : (redirectParam === 'admin' ? 'login|admin' : 'login');

    const lineAuthUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
    lineAuthUrl.searchParams.set('response_type', 'code');
    lineAuthUrl.searchParams.set('client_id', channelId);
    lineAuthUrl.searchParams.set('redirect_uri', redirectUri);
    lineAuthUrl.searchParams.set('scope', 'profile');
    lineAuthUrl.searchParams.set('state', state);

    return NextResponse.redirect(lineAuthUrl.toString());
}
