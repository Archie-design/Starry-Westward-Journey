'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Sword, Users } from 'lucide-react';
import { CharacterStats, W4Application, SquadMemberStats } from '@/types';
import { reviewW4ByAdmin } from '@/app/actions/w4';

interface CommandantTabProps {
    userData: CharacterStats;
    apps: W4Application[];
    onRefresh: () => void;
    onShowMessage: (msg: string, type: 'success' | 'error' | 'info') => void;
    battalionMembers: Record<string, SquadMemberStats[]>;
}

export function CommandantTab({ userData, apps, onRefresh, onShowMessage, battalionMembers }: CommandantTabProps) {
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});

    const handleReview = async (appId: string, action: 'approve' | 'reject') => {
        setReviewingId(appId);
        try {
            const res = await reviewW4ByAdmin(appId, action, notes[appId] || '', userData.Name);
            if (res.success) {
                onShowMessage(
                    action === 'approve' ? '✅ 已核准入帳，傳愛修為已發放！' : '已駁回此申請。',
                    action === 'approve' ? 'success' : 'info'
                );
                onRefresh();
            } else {
                onShowMessage(res.error || '操作失敗', 'error');
            }
            if (res.warning) onShowMessage(res.warning, 'info');
        } catch (e: any) {
            onShowMessage('系統異常：' + e.message, 'error');
        } finally {
            setReviewingId(null);
        }
    };

    const isActive = (lastCheckIn?: string) => {
        if (!lastCheckIn) return false;
        const today = new Date();
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const todayStr = fmt(today);
        const yestStr = fmt(new Date(today.getTime() - 86400000));
        return lastCheckIn === todayStr || lastCheckIn === yestStr;
    };

    const squadEntries = Object.entries(battalionMembers).map(([name, members]) => {
        const activeCount = members.filter(m => isActive(m.lastCheckIn)).length;
        const rate = members.length > 0 ? activeCount / members.length : 0;
        return { name, members, rate };
    }).sort((a, b) => b.rate - a.rate);

    const allMembers = Object.values(battalionMembers).flat();
    const totalActive = allMembers.filter(m => isActive(m.lastCheckIn)).length;
    const overallRate = allMembers.length > 0 ? totalActive / allMembers.length : 0;

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-gradient-to-br from-rose-950/40 to-slate-900 border-2 border-rose-500/40 rounded-4xl p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-rose-400 font-black text-xs uppercase mb-1 tracking-widest">
                            <Sword size={14} /> 大隊長指揮部
                        </div>
                        <h2 className="text-2xl font-black text-white italic">傳愛申請終審</h2>
                        <p className="text-xs text-slate-400 mt-1">以下為已通過小隊長初審、待終審的傳愛申請</p>
                    </div>
                    <button
                        onClick={onRefresh}
                        className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition-all border border-white/5"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* ── 各隊成員總覽 ── */}
            {allMembers.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Users size={16} className="text-rose-400" />
                        <span className="text-white font-black text-sm">各隊成員修為總覽</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${overallRate >= 0.7 ? 'bg-emerald-500/20 text-emerald-400' : overallRate >= 0.4 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                            大隊活躍率 {Math.round(overallRate * 100)}%
                        </span>
                    </div>
                    {squadEntries.map(({ name, members, rate }) => (
                        <div key={name} className="bg-slate-900 border border-rose-500/15 rounded-3xl p-4 space-y-3 shadow-lg">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-white text-sm">{name}</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${rate >= 0.7 ? 'bg-emerald-500/20 text-emerald-400' : rate >= 0.4 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                    活躍率 {Math.round(rate * 100)}%
                                </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {members.map(m => {
                                    const active = isActive(m.lastCheckIn);
                                    return (
                                        <div key={m.UserID} className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 ${active ? 'text-white' : 'text-slate-500'}`}>
                                            <span className="flex-1 min-w-0 font-bold text-xs truncate">{m.Name}</span>
                                            {m.IsCaptain && (
                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 shrink-0">隊長</span>
                                            )}
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ${active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                                                {active ? '活躍' : '沉寂'}
                                            </span>
                                            <span className="text-xs font-bold shrink-0">Lv.{m.Level}</span>
                                            <span className="text-xs font-black text-rose-300 shrink-0 tabular-nums">{m.Exp.toLocaleString()}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Application list */}
            {apps.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-700/40 rounded-3xl p-10 text-center">
                    <p className="text-slate-500 font-black text-sm">目前無待終審申請</p>
                    <p className="text-slate-600 text-xs mt-1">所有申請均已處理完畢</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {apps.map(app => (
                        <div key={app.id} className="bg-slate-900 border-2 border-rose-500/20 rounded-3xl p-5 space-y-4 shadow-xl">
                            {/* App info */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-black text-white text-base">{app.user_name}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {app.squad_name} · 訪談對象：<span className="text-rose-300">{app.interview_target}</span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">日期：{app.interview_date}</p>
                                    {app.squad_review_notes && (
                                        <p className="text-xs text-indigo-400 mt-1.5 bg-indigo-500/10 px-2 py-1 rounded-lg">
                                            小隊長備註：{app.squad_review_notes}
                                        </p>
                                    )}
                                    {app.description && (
                                        <p className="text-xs text-slate-400 italic mt-1.5">「{app.description}」</p>
                                    )}
                                </div>
                                <span className="shrink-0 text-[10px] font-black text-blue-400 bg-blue-400/10 px-2 py-1 rounded-lg">待終審</span>
                            </div>

                            {/* Notes */}
                            <textarea
                                placeholder="終審備註（選填）"
                                value={notes[app.id] || ''}
                                onChange={e => setNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                                rows={2}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-rose-500 resize-none transition-colors"
                            />

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    disabled={reviewingId === app.id}
                                    onClick={() => handleReview(app.id, 'reject')}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-sm text-red-400 bg-red-600/10 border border-red-600/30 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    <XCircle size={14} /> 駁回
                                </button>
                                <button
                                    disabled={reviewingId === app.id}
                                    onClick={() => handleReview(app.id, 'approve')}
                                    className="flex-[2] flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-sm text-white bg-emerald-600 shadow-lg shadow-emerald-900/30 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    <CheckCircle2 size={14} /> {reviewingId === app.id ? '處理中…' : '核准入帳'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
