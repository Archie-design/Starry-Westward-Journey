'use server';

import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { getWeeklyMonday } from '@/lib/utils/time';
import type { WeeklyReview, CaptainBriefing } from '@/types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ─────────────────────────────────────────────────────────────────────────────
// API 重試機制 (Exponential Backoff + Jitter) 以處理 429 TooManyRequests
// ─────────────────────────────────────────────────────────────────────────────
async function generateContentWithRetry(aiClient: GoogleGenAI, options: any, maxRetries = 4) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await aiClient.models.generateContent(options);
        } catch (error: any) {
            // Spending cap is a billing issue — retrying won't help, fail immediately
            const isSpendingCap = error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('spending cap');
            if (isSpendingCap) throw new Error('AI_SPENDING_CAP');

            const isRateLimit = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('TooManyRequests') || error?.message?.includes('quota');
            if (isRateLimit && i < maxRetries - 1) {
                const waitTime = Math.pow(2, i) * 1000 + Math.random() * 1000; // 1s, 2s, 4s + jitter
                console.warn(`[Gemini API] Rate Limit Exceeded. Retrying in ${Math.round(waitTime)}ms (Attempt ${i + 1})...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            throw error;
        }
    }
    throw new Error('API Rate Limit Exceeded: 已達最大重試次數，請稍候重試');
}

// ─────────────────────────────────────────────────────────────────────────────
// AI 修行週報
// ─────────────────────────────────────────────────────────────────────────────
export async function generateWeeklyReview(
    userId: string
): Promise<{ success: boolean; review?: WeeklyReview; weekLabel?: string; error?: string }> {
    if (!process.env.GEMINI_API_KEY) {
        return { success: false, error: 'GEMINI_API_KEY 未設定' };
    }

    try {
        // 1. Fetch user stats
        const { data: user, error: userErr } = await supabase
            .from('CharacterStats')
            .select('*')
            .eq('UserID', userId)
            .single();
        if (userErr || !user) return { success: false, error: '無效的使用者' };

        // 2. Compute week boundaries (using Taiwan-aware Monday)
        const now = new Date();
        const twFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Taipei',
            year: 'numeric', month: '2-digit', day: '2-digit',
        });
        const twDateStr = twFormatter.format(now);
        const twDate = new Date(twDateStr + 'T00:00:00');
        const thisWeekMonday = getWeeklyMonday(twDate);
        const prevWeekMonday = new Date(thisWeekMonday);
        prevWeekMonday.setDate(prevWeekMonday.getDate() - 7);
        const nextWeekMonday = new Date(thisWeekMonday);
        nextWeekMonday.setDate(nextWeekMonday.getDate() + 7);

        const weekLabel = thisWeekMonday.toISOString().slice(0, 10);

        // 3. Check DB cache first — avoid calling Gemini if review already exists this week
        const { data: cached } = await supabase
            .from('WeeklyReviews')
            .select('content')
            .eq('user_id', userId)
            .eq('week_label', weekLabel)
            .maybeSingle();
        if (cached) {
            const cachedReview = cached.content as WeeklyReview;
            // Skip stale 0% cache — regenerate if user now has check-ins
            if ((cachedReview.weeklyRate ?? 0) > 0) {
                return { success: true, review: cachedReview, weekLabel };
            }
        }

        // 4. Fetch this week's daily quest logs (q1~q7 only)
        const { data: thisLogs } = await supabase
            .from('DailyLogs')
            .select('"QuestTitle","Timestamp"')
            .eq('UserID', userId)
            .gte('Timestamp', thisWeekMonday.toISOString())
            .lt('Timestamp', nextWeekMonday.toISOString())
            .like('QuestID', 'q%')
            .order('Timestamp');

        // 5. Fetch previous week's daily quest logs
        const { data: prevLogs } = await supabase
            .from('DailyLogs')
            .select('"QuestTitle","Timestamp"')
            .eq('UserID', userId)
            .gte('Timestamp', prevWeekMonday.toISOString())
            .lt('Timestamp', thisWeekMonday.toISOString())
            .like('QuestID', 'q%');

        const thisLogsArr = thisLogs ?? [];
        const prevLogsArr = prevLogs ?? [];

        // 6. Derive trend and weakest stat
        const thisRate = thisLogsArr.length / 21;
        const prevRate = prevLogsArr.length / 21;
        const delta = thisRate - prevRate;
        const trend: 'up' | 'down' | 'stable' =
            delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'stable';

        const statMap: Record<string, number> = {
            '根骨': user.Physique, '神識': user.Spirit, '魅力': user.Charisma,
            '悟性': user.Savvy, '機緣': user.Luck, '潛力': user.Potential,
        };
        const weakestStatName = Object.entries(statMap).sort((a, b) => a[1] - b[1])[0][0];

        const trendLabel = trend === 'up' ? '精進中 ↑' : trend === 'down' ? '懈怠中 ↓' : '持平 →';
        const thisWeekMondayStr = thisWeekMonday.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' });

        const prompt = `
你是《大無限開運西遊》的「洞天福地覆盤官」。這款遊戲鼓勵玩家藉由現實生活的習慣養成來獲得修為成長。
每週一，你需要為每位修行者撰寫一份「修行週報」，回顧他們上週的定課完成情況，並給予有溫度的鼓勵或棒喝。

【修行者資訊】
姓名：${user.Name}
角色定位：${user.Role}（第 ${user.Level} 層，修為 ${user.Exp}）
六維屬性：根骨 ${user.Physique} ／ 神識 ${user.Spirit} ／ 魅力 ${user.Charisma} ／ 悟性 ${user.Savvy} ／ 機緣 ${user.Luck} ／ 潛力 ${user.Potential}
最弱屬性：${weakestStatName}

【本週定課紀錄 (${thisWeekMondayStr} 起)】
完成次數：${thisLogsArr.length} / 21（完成率 ${Math.round(thisRate * 100)}%）
詳細：
${thisLogsArr.map((l: any) => `- ${new Date(l.Timestamp).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}：${l.QuestTitle}`).join('\n') || '（本週尚無打卡紀錄）'}

【上週定課紀錄】
完成次數：${prevLogsArr.length} / 21（完成率 ${Math.round(prevRate * 100)}%）

【週間趨勢】：${trendLabel}

【撰寫要求】
1. summary（約 80–100 字）：用第二人稱「你」，結合玩家的最弱屬性與本週完成情況，給予個人化的修行覆盤。語氣根據完成率調整：高（>70%）→ 鼓舞精進；中（40–70%）→ 溫和提醒；低（<40%）→ 當頭棒喝但不失溫度。
2. quote（一句話，15–30 字）：引用一句《西遊記》、道家思想的箴言或自創修行金句，與本週狀態呼應。
3. trend：直接回傳 "up"、"down" 或 "stable"（英文，勿翻譯）。
4. weeklyRate：本週完成率，0 到 1 之間的小數（例如 0.67）。

請嚴格回傳格式正確的純 JSON，不使用 Markdown 標籤：
{
  "summary": "...",
  "quote": "...",
  "trend": "up",
  "weeklyRate": 0.67
}
`;

        const response = await generateContentWithRetry(ai, {
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' },
        });

        const textResponse = response.text;
        if (!textResponse) throw new Error('AI 未回應內容');
        const review: WeeklyReview = JSON.parse(textResponse);
        // Ensure trend is one of the valid values
        if (!['up', 'down', 'stable'].includes(review.trend)) review.trend = trend;

        // 7. Upsert to WeeklyReviews (skip caching empty weeks so future visits can regenerate)
        if (thisLogsArr.length > 0) {
            await supabase
                .from('WeeklyReviews')
                .upsert(
                    { user_id: userId, week_label: weekLabel, content: review },
                    { onConflict: 'user_id,week_label' }
                );
        }

        return { success: true, review, weekLabel };

    } catch (error: any) {
        console.error('Weekly Review Error:', error);
        const msg: string = error.message || '';
        const normalized = (msg === 'AI_SPENDING_CAP' || msg.includes('spending cap') || msg.includes('RESOURCE_EXHAUSTED'))
            ? 'AI_SPENDING_CAP' : msg;
        return { success: false, error: normalized };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI 隊長建議
// ─────────────────────────────────────────────────────────────────────────────
export async function generateCaptainBriefing(
    captainUserId: string
): Promise<{ success: boolean; briefing?: CaptainBriefing; error?: string }> {
    if (!process.env.GEMINI_API_KEY) {
        return { success: false, error: 'GEMINI_API_KEY 未設定' };
    }

    try {
        // 1. Verify captain + get team name
        const { data: captain, error: captainErr } = await supabase
            .from('CharacterStats')
            .select('"TeamName","IsCaptain","Name"')
            .eq('UserID', captainUserId)
            .single();
        if (captainErr || !captain) return { success: false, error: '無效的使用者' };
        if (!captain.IsCaptain) return { success: false, error: '非隊長無法使用此功能' };
        if (!captain.TeamName) return { success: false, error: '尚未分配小隊' };

        // 2. Compute this week's label (Taiwan timezone Monday)
        const now = new Date();
        const twFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Taipei',
            year: 'numeric', month: '2-digit', day: '2-digit',
        });
        const twDate = new Date(twFormatter.format(now) + 'T00:00:00');
        const thisWeekMonday = getWeeklyMonday(twDate);
        const weekLabel = thisWeekMonday.toISOString().slice(0, 10);

        // 3. Fetch all team members (no cache — regenerated on every request per design spec)
        const { data: members, error: membersErr } = await supabase
            .from('CharacterStats')
            .select('*')
            .eq('TeamName', captain.TeamName)
            .order('Level', { ascending: false });
        if (membersErr || !members || members.length === 0) {
            return { success: false, error: '小隊目前無成員' };
        }

        // 5. Batch-fetch last 7 days logs for all members (avoid N+1)
        const past7Date = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
        const memberIds = members.map((m: any) => m.UserID);
        const { data: logsData } = await supabase
            .from('DailyLogs')
            .select('"UserID","QuestTitle","Timestamp"')
            .in('UserID', memberIds)
            .gte('Timestamp', past7Date)
            .like('QuestID', 'q%')
            .order('UserID')
            .order('Timestamp');

        const logs = logsData ?? [];

        // 6. Group logs by UserID
        const logsByUser = new Map<string, any[]>();
        for (const log of logs) {
            if (!logsByUser.has(log.UserID)) logsByUser.set(log.UserID, []);
            logsByUser.get(log.UserID)!.push(log);
        }

        // 7. Compute team average + identify top/support
        const memberStats = members.map((m: any) => ({
            name: m.Name,
            role: m.Role,
            level: m.Level,
            count: logsByUser.get(m.UserID)?.length ?? 0,
            rate: (logsByUser.get(m.UserID)?.length ?? 0) / 21,
        }));
        const teamAvgRate = memberStats.reduce((s: number, m: any) => s + m.rate, 0) / memberStats.length;
        const teamMorale: 'high' | 'medium' | 'low' =
            teamAvgRate > 0.7 ? 'high' : teamAvgRate >= 0.4 ? 'medium' : 'low';

        const prompt = `
你是《大無限開運西遊》的「洞天軍情分析師」，專為小隊隊長提供隊務報告。
請根據以下資料，對小隊過去 7 天的修行表現進行分析，並給予隊長具體可行的建議。

【小隊資訊】
小隊名稱：${captain.TeamName}
隊長：${captain.Name}
隊員人數：${members.length} 人

【各隊員近 7 天定課表現】
${memberStats.map((m: any) => `- ${m.name}（${m.role}，Lv${m.level}）：完成 ${m.count}/21 次（${Math.round(m.rate * 100)}%）`).join('\n')}

【小隊平均完成率】：${Math.round(teamAvgRate * 100)}%

【生成要求】
1. teamSummary（約 80–100 字）：整體評述小隊本週士氣與表現，使用第二人稱「你的小隊」向隊長說話，語氣如資深修行導師。
2. topPerformer（格式：「姓名：一句鼓勵語（15 字以內）」）：本週完成率最高的隊員。若並列取 Level 較高者。
3. needsSupport（陣列）：完成率低於 33% 的隊員姓名，若無則回傳空陣列 []。
4. suggestion（約 50 字）：針對小隊整體狀態給隊長一個本週具體行動建議（如何互相提醒、設置儀式等）。
5. teamMorale：根據平均完成率判斷，高（>70%）→ "high"；中（40–70%）→ "medium"；低（<40%）→ "low"（英文）。

請嚴格回傳格式正確的純 JSON，不使用 Markdown 標籤：
{
  "teamSummary": "...",
  "topPerformer": "姓名：鼓勵語",
  "needsSupport": [],
  "suggestion": "...",
  "teamMorale": "high"
}
`;

        const response = await generateContentWithRetry(ai, {
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' },
        });

        const textResponse = response.text;
        if (!textResponse) throw new Error('AI 未回應內容');
        const briefing: CaptainBriefing = JSON.parse(textResponse);
        if (!['high', 'medium', 'low'].includes(briefing.teamMorale)) briefing.teamMorale = teamMorale;

        return { success: true, briefing };

    } catch (error: any) {
        console.error('Captain Briefing Error:', error);
        const msg: string = error.message || '';
        const normalized = (msg === 'AI_SPENDING_CAP' || msg.includes('spending cap') || msg.includes('RESOURCE_EXHAUSTED'))
            ? 'AI_SPENDING_CAP' : msg;
        return { success: false, error: normalized };
    }
}
