import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    `[supabaseAdmin] 缺少必要環境變數：${!url ? 'NEXT_PUBLIC_SUPABASE_URL' : ''}${!key ? ' SUPABASE_SERVICE_ROLE_KEY' : ''}。` +
    '請確認 .env.local 已正確設定，禁止以 anon key 降級執行 server actions。'
  );
}

export const supabaseAdmin = createClient(url, key);
