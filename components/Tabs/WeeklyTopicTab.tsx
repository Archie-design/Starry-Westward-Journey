import { useState } from 'react';
import { Quest, DailyLog, SystemSettings, TemporaryQuest, W4Application, WeeklyReview } from '@/types';
import { WEEKLY_QUEST_CONFIG } from '@/lib/constants';
import { getLogicalDateStr } from '@/lib/utils/time';

interface WeeklyTopicTabProps {
    systemSettings: SystemSettings;
    logs: DailyLog[];
    currentWeeklyMonday: Date;
    isTopicDone: boolean;
    temporaryQuests: TemporaryQuest[];
    userInventory: string[];
    teamInventory?: string[];
    w4Applications: W4Application[];
    weeklyReview: WeeklyReview | null;
    isLoadingReview: boolean;
    onCheckIn: (q: Quest) => void;
    onUndo: (q: Quest) => void;
    onSubmitW4: (data: { interviewTarget: string; interviewDate: string; description: string }) => Promise<void>;
}

const W4_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: '🟡 待小隊長審核', color: 'text-yellow-400' },
    squad_approved: { label: '🔵 待管理員核實', color: 'text-blue-400' },
    approved: { label: '🟢 已核准（已入帳）', color: 'text-emerald-400' },
    rejected: { label: '🔴 已駁回', color: 'text-red-400' },
};

export function WeeklyTopicTab({ systemSettings, logs, currentWeeklyMonday, isTopicDone, temporaryQuests, userInventory, teamInventory = [], w4Applications, weeklyReview, isLoadingReview, onCheckIn, onUndo, onSubmitW4 }: WeeklyTopicTabProps) {
    // a1/a5：個人總經驗 ×1.2（與 quest.ts 伺服器邏輯一致，適用所有副本）
    const baseMultiplier = (userInventory.includes('a1') || userInventory.includes('a5')) ? 1.2 : 1;
    // t1 主題親證不受 a4 影響
    const topicExp = Math.ceil(1000 * baseMultiplier);
    // a4 (幌金繩)：參加心成活動（w2）×1.5（與 quest.ts 伺服器邏輯一致）
    const w2Multiplier = baseMultiplier * (teamInventory.includes('a4') ? 1.5 : 1);

    const [showW4Form, setShowW4Form] = useState(false);
    const [w4Target, setW4Target] = useState('');
    const [w4Date, setW4Date] = useState(getLogicalDateStr(new Date()));
    const [w4Desc, setW4Desc] = useState('');
    const [isSubmittingW4, setIsSubmittingW4] = useState(false);

    const handleW4Submit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        if (!w4Target.trim()) return;
        setIsSubmittingW4(true);
        await onSubmitW4({ interviewTarget: w4Target, interviewDate: w4Date, description: w4Desc });
        setIsSubmittingW4(false);
        setShowW4Form(false);
        setW4Target('');
        setW4Desc('');
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-right-8 duration-500 text-center mx-auto text-center">

            {/* ── AI 修行週報 ── */}
            {isLoadingReview ? (
                <div className="p-6 rounded-4xl border-2 border-indigo-500/30 bg-indigo-950/20 flex items-center justify-center gap-3 text-indigo-400 text-sm font-bold">
                    <span className="animate-spin text-xl">🔮</span> AI 正在推演本週修行覆盤…
                </div>
            ) : weeklyReview ? (
                <div className="p-6 rounded-4xl border-2 border-indigo-500/40 bg-indigo-950/20 shadow-2xl space-y-4 text-left">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🔮</span>
                        <div>
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">AI 修行週報</span>
                            <h3 className="text-lg font-black text-white">本週覆盤</h3>
                        </div>
                        <span className={`ml-auto text-xs font-black px-3 py-1 rounded-lg ${
                            weeklyReview.trend === 'up' ? 'bg-emerald-500/20 text-emerald-400' :
                            weeklyReview.trend === 'down' ? 'bg-red-500/20 text-red-400' :
                            'bg-slate-700 text-slate-400'
                        }`}>
                            {weeklyReview.trend === 'up' ? '精進中 ↑' : weeklyReview.trend === 'down' ? '懈怠中 ↓' : '持平 →'}
                            {' '}{Math.round(weeklyReview.weeklyRate * 100)}%
                        </span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{weeklyReview.summary}</p>
                    <blockquote className="border-l-2 border-indigo-500 pl-4 text-xs text-indigo-300 italic font-bold">
                        {weeklyReview.quote}
                    </blockquote>
                </div>
            ) : null}

            <div className="p-8 rounded-4xl border-2 border-yellow-500/50 bg-yellow-500/5 shadow-2xl relative overflow-hidden text-center mx-auto">
                <div className="flex items-center gap-6 mb-6 text-left text-center justify-center">
                    <div className="text-6xl mx-auto">🎯</div>
                    <div className="flex-1">
                        <span className="bg-yellow-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase mb-1 inline-block">雙週挑戰</span>
                        <h3 className="text-2xl font-black text-white italic uppercase">主題親證</h3>
                        <p className="text-sm text-yellow-400 font-bold mt-1 italic">「{systemSettings.TopicQuestTitle}」</p>
                    </div>
                    <div className="text-right bg-yellow-500/10 px-3 py-2 rounded-xl">
                        <div className="text-sm font-black text-yellow-500">+{topicExp} 修為</div>
                        <div className="text-xs font-bold text-yellow-400">+100 🪙</div>
                    </div>
                </div>
                <button
                    onClick={() => !isTopicDone ? onCheckIn({ id: 't1', title: '主題親證', reward: 1000 }) : onUndo({ id: 't1', title: '主題親證', reward: 1000 })}
                    className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${isTopicDone ? 'bg-emerald-600/20 text-emerald-400 shadow-inner' : 'bg-yellow-500 text-slate-950 shadow-lg active:scale-95'}`}>
                    {isTopicDone ? "本期已圓滿 (點擊回溯) ✓" : "回報主題修行"}
                </button>
            </div>

            {WEEKLY_QUEST_CONFIG.filter(q => q.id !== 'w4').map(q => {
                const comps = logs.filter(l => l.QuestID.startsWith(q.id) && new Date(l.Timestamp) >= currentWeeklyMonday).length;
                const isMax = q.limit !== 99 && comps >= (q.limit || 0);
                return (
                    <div key={q.id} className={`p-8 rounded-4xl bg-slate-900 border border-white/5 shadow-2xl ${isMax ? 'opacity-50 grayscale' : ''}`}>
                        <div className="flex items-center gap-6 mb-8 text-left text-center justify-center mx-auto">
                            <div className="text-6xl mx-auto">{q.icon}</div>
                            <div className="flex-1 text-left">
                                <h3 className="text-2xl font-black text-white">{q.title}</h3>
                                <p className="text-sm text-slate-400 font-bold italic">{q.sub}</p>
                            </div>
                            <div className="text-right bg-blue-400/10 px-3 py-2 rounded-xl">
                                <div className="text-sm font-black text-blue-400">+{Math.ceil(q.reward * (q.id === 'w2' ? w2Multiplier : baseMultiplier))} 修為</div>
                                <div className="text-xs font-bold text-yellow-400">+{Math.floor(q.reward * 0.1)} 🪙</div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center px-2 mx-auto">
                            {['一', '二', '三', '四', '五', '六', '日'].map((day, idx) => {
                                const d = new Date();
                                const currentDay = d.getDay() || 7;
                                const diff = (idx + 1) - currentDay;
                                d.setDate(d.getDate() + diff);
                                const qId = `${q.id}|${getLogicalDateStr(d)}`;
                                const isDone = logs.some(l => l.QuestID === qId);
                                return (
                                    <div key={idx} className="flex flex-col items-center gap-1.5">
                                        <span className="text-[10px] text-slate-500 font-mono tracking-tighter">{d.getMonth() + 1}/{d.getDate()}</span>
                                        <button title={`${day}`} onClick={() => !isDone ? (!isMax && onCheckIn({ ...q, id: qId })) : onUndo({ ...q, id: qId })} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${isDone ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>{day}</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {/* w4 傳愛分數 — 申請制 */}
            <div className="p-8 rounded-4xl bg-slate-900 border border-pink-500/20 shadow-2xl">
                <div className="flex items-center gap-6 mb-6 text-left justify-center mx-auto">
                    <div className="text-6xl mx-auto">❤️</div>
                    <div className="flex-1 text-left">
                        <h3 className="text-2xl font-black text-white">傳愛分數</h3>
                        <p className="text-sm text-slate-400 font-bold italic">訪談成功加分 · 三級審核制</p>
                    </div>
                    <div className="text-right bg-pink-500/10 px-3 py-2 rounded-xl">
                        <div className="text-sm font-black text-pink-400">+{Math.ceil(1000 * baseMultiplier)} 修為</div>
                        <div className="text-xs font-bold text-yellow-400">+100 🪙</div>
                    </div>
                </div>

                {!showW4Form ? (
                    <button
                        onClick={() => setShowW4Form(true)}
                        className="w-full py-4 rounded-2xl font-black text-lg bg-pink-600 text-white shadow-lg active:scale-95 transition-all"
                    >
                        ❤️ 提交傳愛申請
                    </button>
                ) : (
                    <form onSubmit={handleW4Submit} className="space-y-4 text-left">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">傳愛對象 *</label>
                            <input
                                required
                                value={w4Target}
                                onChange={e => setW4Target(e.target.value)}
                                placeholder="例：王小明"
                                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white font-bold outline-none focus:border-pink-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">訪談日期 *</label>
                            <input
                                required
                                type="date"
                                value={w4Date}
                                onChange={e => setW4Date(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white font-bold outline-none focus:border-pink-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">簡述（選填）</label>
                            <textarea
                                value={w4Desc}
                                onChange={e => setW4Desc(e.target.value)}
                                placeholder="簡述訪談過程或成果..."
                                rows={3}
                                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white font-bold outline-none focus:border-pink-500 resize-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setShowW4Form(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-2xl">取消</button>
                            <button type="submit" disabled={isSubmittingW4} className="flex-2 py-3 bg-pink-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                {isSubmittingW4 ? '提交中...' : '確認送出'}
                            </button>
                        </div>
                    </form>
                )}

                {w4Applications.length > 0 && (
                    <div className="mt-6 space-y-3">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest text-left">申請記錄</p>
                        {w4Applications.map(app => {
                            const statusInfo = W4_STATUS_LABELS[app.status] || { label: app.status, color: 'text-slate-400' };
                            return (
                                <div key={app.id} className="bg-slate-800 rounded-2xl p-4 text-left space-y-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-white text-sm">傳愛對象：{app.interview_target}</p>
                                            <p className="text-xs text-slate-500">{app.interview_date}</p>
                                        </div>
                                        <span className={`text-xs font-black ${statusInfo.color}`}>{statusInfo.label}</span>
                                    </div>
                                    {app.description && <p className="text-xs text-slate-400 italic">{app.description}</p>}
                                    {app.status === 'rejected' && (app.squad_review_notes || app.final_review_notes) && (
                                        <p className="text-xs text-red-400 font-bold">駁回原因：{app.final_review_notes || app.squad_review_notes}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {userInventory.includes('a6') && (() => {
                const PREFIX = 'bd_yuanmeng';
                const weekComps = logs.filter(l => l.QuestID.startsWith(PREFIX) && new Date(l.Timestamp) >= currentWeeklyMonday).length;
                const weekFull = weekComps >= 3;
                return (
                    <div className="pt-8 border-t-2 border-slate-800 border-dashed space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xl font-black text-purple-400 uppercase tracking-widest">🪬 親證圓夢計劃</h3>
                            <span className="text-xs font-black text-slate-500">{weekComps} / 3 次</span>
                        </div>
                        <div className="p-8 rounded-4xl bg-purple-950/20 border border-purple-500/30 shadow-2xl">
                            <div className="flex items-center gap-4 mb-6 justify-center">
                                <div className="text-5xl">🪬</div>
                                <div className="text-left">
                                    <h4 className="text-xl font-black text-white">親證圓夢計劃</h4>
                                    <p className="text-xs text-purple-300 font-bold mt-1">持有定風珠專屬 · 每週上限 3 次 · 每次 +{Math.ceil(300 * baseMultiplier)} 修為 / +30 🪙</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center px-2">
                                {['一', '二', '三', '四', '五', '六', '日'].map((day, idx) => {
                                    const d = new Date();
                                    const currentDay = d.getDay() || 7;
                                    const diff = (idx + 1) - currentDay;
                                    d.setDate(d.getDate() + diff);
                                    const qId = `${PREFIX}|${getLogicalDateStr(d)}`;
                                    const isDone = logs.some(l => l.QuestID === qId);
                                    const isDisabled = !isDone && weekFull;
                                    return (
                                        <div key={idx} className="flex flex-col items-center gap-1.5">
                                            <span className="text-[10px] text-slate-500 font-mono tracking-tighter">{d.getMonth() + 1}/{d.getDate()}</span>
                                            <button
                                                title={day}
                                                disabled={isDisabled}
                                                onClick={() => !isDone ? onCheckIn({ id: qId, title: '親證圓夢計劃', reward: 300, dice: 0 }) : onUndo({ id: qId, title: '親證圓夢計劃', reward: 300, dice: 0 })}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${isDone ? 'bg-purple-500 text-white shadow-lg' : isDisabled ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                                            >{day}</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {temporaryQuests.length > 0 && (
                <div className="pt-8 border-t-2 border-slate-800 border-dashed space-y-8">
                    <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest text-center">⏳ 臨時加分任務</h3>
                    {temporaryQuests.map(tq => {
                        const comps = logs.filter(l => l.QuestID.startsWith(tq.id)).length;
                        const isMax = comps >= 1;
                        return (
                            <div key={tq.id} className={`p-8 rounded-4xl bg-slate-900 border border-emerald-500/20 shadow-2xl relative overflow-hidden ${isMax ? 'opacity-50 grayscale' : ''}`}>
                                <div className="absolute top-0 right-0 bg-emerald-600/20 text-emerald-500 px-3 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest">
                                    大會臨時發布
                                </div>
                                <div className="flex items-center gap-6 mb-8 text-left text-center justify-center mx-auto mt-2">
                                    <div className="text-6xl mx-auto">✨</div>
                                    <div className="flex-1 text-left">
                                        <h3 className="text-2xl font-black text-white">{tq.title}</h3>
                                        {tq.sub && <p className="text-sm text-orange-300 font-bold mt-1">{tq.sub}</p>}
                                        {tq.desc && <p className="text-xs text-slate-400 mt-1 italic">{tq.desc}</p>}
                                    </div>
                                    <div className="text-right bg-emerald-400/10 px-3 py-2 rounded-xl">
                                        <div className="text-sm font-black text-emerald-400">+{Math.ceil(tq.reward * baseMultiplier)} 修為</div>
                                        <div className="text-xs font-bold text-yellow-400">+{Math.floor(tq.reward * 0.1)} 🪙</div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center px-2 mx-auto">
                                    {['一', '二', '三', '四', '五', '六', '日'].map((day, idx) => {
                                        const d = new Date();
                                        const currentDay = d.getDay() || 7;
                                        const diff = (idx + 1) - currentDay;
                                        d.setDate(d.getDate() + diff);
                                        const qId = `${tq.id}|${getLogicalDateStr(d)}`;
                                        const isDone = logs.some(l => l.QuestID === qId);
                                        return (
                                            <div key={idx} className="flex flex-col items-center gap-1.5">
                                                <span className="text-[10px] text-slate-500 font-mono tracking-tighter">{d.getMonth() + 1}/{d.getDate()}</span>
                                                <button title={`${day}`} onClick={() => !isDone ? (!isMax && onCheckIn({ ...tq, id: qId })) : onUndo({ ...tq, id: qId })} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${isDone ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>{day}</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
