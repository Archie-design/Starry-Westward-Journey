'use client';

import React, { useState, useEffect } from 'react';
import { Heart, BookOpen, X, Mountain, Plus, CheckCircle, XCircle, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import type { W4Application, Testimony, PeakTrial, PeakTrialRegistration, PeakTrialReview } from '@/types';
import { useAdmin } from '../AdminContext';
import { reviewW4ByAdmin, getW4Applications } from '@/app/actions/w4';
import { getTestimonies } from '@/app/actions/testimonies_admin';
import { deleteTestimony } from '@/app/actions/admin';
import {
    listPeakTrials, upsertPeakTrial, deletePeakTrial, togglePeakTrialActive,
    listPeakTrialRegistrations, listPeakTrialReviews, reviewPeakTrialSubmission,
} from '@/app/actions/peak_trial';

type SubTab = 'w4' | 'testimony' | 'peak';

export function ReviewModule() {
    const { actorName, showMessage } = useAdmin();
    const [subTab, setSubTab] = useState<SubTab>('w4');

    // W4 state
    const [apps, setApps] = useState<W4Application[]>([]);
    const [testimonies, setTestimonies] = useState<Testimony[]>([]);
    const [w4Notes, setW4Notes] = useState<Record<string, string>>({});
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Peak trial state
    const [trials, setTrials] = useState<PeakTrial[]>([]);
    const [peakLoading, setPeakLoading] = useState(false);
    const [editingTrial, setEditingTrial] = useState<Partial<PeakTrial> | null>(null);
    const [expandedTrial, setExpandedTrial] = useState<string | null>(null);
    const [trialRegs, setTrialRegs] = useState<PeakTrialRegistration[]>([]);
    const [trialReviews, setTrialReviews] = useState<(PeakTrialReview & { user_id: string; user_name: string })[]>([]);
    const [regsLoading, setRegsLoading] = useState(false);

    // Load W4 & testimonies
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [w4Res, testRes] = await Promise.all([
                getW4Applications({ status: 'squad_approved' }),
                getTestimonies(),
            ]);
            if (w4Res.success) setApps(w4Res.applications);
            if (testRes) setTestimonies(testRes as Testimony[]);
            setLoading(false);
        };
        load();
    }, []);

    // Load peak trials when tab switches
    useEffect(() => {
        if (subTab === 'peak' && trials.length === 0) loadTrials();
    }, [subTab]);

    const loadTrials = async () => {
        setPeakLoading(true);
        const res = await listPeakTrials();
        if (res.success) setTrials(res.trials);
        setPeakLoading(false);
    };

    const handleW4Review = async (appId: string, approve: boolean) => {
        setReviewingId(appId);
        const res = await reviewW4ByAdmin(appId, approve ? 'approve' : 'reject', w4Notes[appId] || '');
        if (res.success) {
            setApps(prev => prev.filter(a => a.id !== appId));
            showMessage(approve ? '已核准入帳！修為已發放。' : '已駁回申請。', approve ? 'success' : 'info');
        } else {
            showMessage((res as any).error || '審核失敗', 'error');
        }
        setReviewingId(null);
        setW4Notes(prev => { const n = { ...prev }; delete n[appId]; return n; });
    };

    const handleDeleteTestimony = async (id: string) => {
        await deleteTestimony(id);
        setTestimonies(prev => prev.filter(t => t.id !== id));
    };

    const exportTestimoniesCSV = () => {
        const header = '姓名,類別,日期,內容,建立時間';
        const rows = testimonies.map(t => [
            t.parsed_name ?? t.display_name ?? '',
            t.parsed_category ?? '',
            t.parsed_date ?? '',
            `"${(t.content ?? '').replace(/"/g, '""')}"`,
            new Date(t.created_at).toLocaleString('zh-TW'),
        ].join(','));
        const csv = [header, ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `親證故事_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Peak trial handlers
    const handleSaveTrial = async () => {
        if (!editingTrial?.title) return;
        const res = await upsertPeakTrial({
            id: editingTrial.id,
            title: editingTrial.title,
            description: editingTrial.description,
            start_date: editingTrial.start_date,
            end_date: editingTrial.end_date,
            max_participants: editingTrial.max_participants,
            is_active: editingTrial.is_active ?? true,
            created_by: actorName,
        });
        if (res.success) {
            showMessage(editingTrial.id ? '試煉已更新' : '試煉已建立', 'success');
            setEditingTrial(null);
            loadTrials();
        } else showMessage(res.error || '儲存失敗', 'error');
    };

    const handleDeleteTrial = async (id: string) => {
        if (!confirm('確定刪除此試煉？所有報名資料將一併刪除。')) return;
        const res = await deletePeakTrial(id);
        if (res.success) setTrials(prev => prev.filter(t => t.id !== id));
        else showMessage(res.error || '刪除失敗', 'error');
    };

    const handleToggleTrial = async (id: string, active: boolean) => {
        const res = await togglePeakTrialActive(id, active);
        if (res.success) setTrials(prev => prev.map(t => t.id === id ? { ...t, is_active: active } : t));
    };

    const handleExpandTrial = async (trialId: string) => {
        if (expandedTrial === trialId) { setExpandedTrial(null); return; }
        setExpandedTrial(trialId);
        setRegsLoading(true);
        const [regsRes, reviewsRes] = await Promise.all([
            listPeakTrialRegistrations(trialId),
            listPeakTrialReviews(trialId),
        ]);
        if (regsRes.success) setTrialRegs(regsRes.registrations);
        if (reviewsRes.success) setTrialReviews(reviewsRes.reviews);
        setRegsLoading(false);
    };

    const handleReviewSubmission = async (reviewId: string, status: 'approved' | 'rejected') => {
        const res = await reviewPeakTrialSubmission(reviewId, status, actorName);
        if (res.success) {
            setTrialReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status, reviewed_by: actorName, reviewed_at: new Date().toISOString() } : r));
            showMessage(status === 'approved' ? '已核准' : '已駁回', 'success');
        } else showMessage(res.error || '審核失敗', 'error');
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-black text-white">審核中心</h2>

            {/* Sub-tabs */}
            <div className="flex gap-2 flex-wrap">
                <button onClick={() => setSubTab('w4')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-xl transition-all ${
                        subTab === 'w4' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}>
                    <Heart size={14} /> 傳愛終審
                    {apps.length > 0 && <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{apps.length}</span>}
                </button>
                <button onClick={() => setSubTab('testimony')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-xl transition-all ${
                        subTab === 'testimony' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}>
                    <BookOpen size={14} /> 親證故事（{testimonies.length}）
                </button>
                <button onClick={() => setSubTab('peak')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-xl transition-all ${
                        subTab === 'peak' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}>
                    <Mountain size={14} /> 巔峰試煉
                </button>
            </div>

            {/* === W4 Final Review === */}
            {subTab === 'w4' && (
                <section className="space-y-4">
                    <div className="bg-slate-900 border-2 border-pink-500/20 p-6 rounded-3xl shadow-xl space-y-4">
                        {loading ? (
                            <p className="text-sm text-slate-500 text-center py-4">載入中...</p>
                        ) : apps.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">目前無待終審申請</p>
                        ) : apps.map(app => (
                            <div key={app.id} className="bg-slate-800 rounded-2xl p-5 space-y-3">
                                <div className="flex justify-between items-start flex-wrap gap-2">
                                    <div>
                                        <p className="font-black text-white">{app.user_name}</p>
                                        <p className="text-xs text-slate-400">{app.squad_name} · 訪談：{app.interview_target} · {app.interview_date}</p>
                                        {app.squad_review_notes && <p className="text-xs text-indigo-400 mt-1">小隊長備註：{app.squad_review_notes}</p>}
                                    </div>
                                    <span className="text-[10px] font-black text-blue-400 bg-blue-400/10 px-2 py-1 rounded-lg">待終審</span>
                                </div>
                                {app.description && <p className="text-xs text-slate-400 italic">{app.description}</p>}
                                <textarea placeholder="終審備註（選填）" value={w4Notes[app.id] || ''}
                                    onChange={e => setW4Notes(prev => ({ ...prev, [app.id]: e.target.value }))} rows={2}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-xl p-3 text-white text-xs outline-none focus:border-pink-500 resize-none" />
                                <div className="flex gap-3">
                                    <button disabled={reviewingId === app.id} onClick={() => handleW4Review(app.id, false)}
                                        className="flex-1 py-2 bg-red-600/20 text-red-400 font-black rounded-xl text-sm border border-red-600/30 active:scale-95 transition-all disabled:opacity-50">
                                        駁回
                                    </button>
                                    <button disabled={reviewingId === app.id} onClick={() => handleW4Review(app.id, true)}
                                        className="flex-1 py-2 bg-emerald-600 text-white font-black rounded-xl text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                        核准入帳
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* === Testimonies === */}
            {subTab === 'testimony' && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-orange-500 font-black text-sm uppercase tracking-widest">
                            <BookOpen size={14} /> 親證故事存檔（{testimonies.length} 筆）
                        </div>
                        {testimonies.length > 0 && (
                            <button onClick={exportTestimoniesCSV}
                                className="text-xs font-black text-slate-400 hover:text-orange-400 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700">
                                ↓ 匯出 CSV
                            </button>
                        )}
                    </div>
                    <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-xl max-h-[500px] overflow-y-auto divide-y divide-slate-800">
                        {testimonies.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8">尚無親證故事記錄</p>
                        ) : testimonies.map(t => (
                            <div key={t.id} className="p-4 hover:bg-white/5 transition-colors group">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-white">
                                            {t.parsed_name ?? t.display_name ?? '未知'}
                                            {t.parsed_category && <span className="ml-2 text-[10px] font-normal bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-lg">{t.parsed_category}</span>}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-3">{t.content}</p>
                                    </div>
                                    <div className="flex items-start gap-2 shrink-0">
                                        <div className="text-right text-[10px] text-slate-500 space-y-1">
                                            <p>{t.parsed_date ?? '日期未填'}</p>
                                            <p>{new Date(t.created_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <button onClick={() => handleDeleteTestimony(t.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all" title="刪除">
                                            <X size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* === Peak Trials === */}
            {subTab === 'peak' && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-violet-500 font-black text-sm uppercase tracking-widest">
                            <Mountain size={14} /> 巔峰試煉管理
                        </div>
                        <button onClick={() => setEditingTrial({ title: '', is_active: true })}
                            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-black rounded-xl transition-colors">
                            <Plus size={14} /> 新增試煉
                        </button>
                    </div>

                    {/* Edit/Create form */}
                    {editingTrial && (
                        <div className="bg-slate-900 border-2 border-violet-500/30 p-5 rounded-3xl shadow-xl space-y-4">
                            <p className="text-xs font-black text-violet-400">{editingTrial.id ? '編輯試煉' : '新增試煉'}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input value={editingTrial.title || ''} onChange={e => setEditingTrial(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="試煉名稱 *" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-violet-500" />
                                <input value={editingTrial.description || ''} onChange={e => setEditingTrial(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="說明（選填）" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-violet-500" />
                                <input type="date" value={editingTrial.start_date || ''} onChange={e => setEditingTrial(prev => ({ ...prev, start_date: e.target.value }))}
                                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-violet-500" />
                                <input type="date" value={editingTrial.end_date || ''} onChange={e => setEditingTrial(prev => ({ ...prev, end_date: e.target.value }))}
                                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-violet-500" />
                                <input type="number" value={editingTrial.max_participants || ''} onChange={e => setEditingTrial(prev => ({ ...prev, max_participants: parseInt(e.target.value) || undefined }))}
                                    placeholder="人數上限（選填）" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-violet-500" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingTrial(null)} className="flex-1 bg-slate-700 p-3 rounded-xl text-slate-300 font-black text-sm">取消</button>
                                <button onClick={handleSaveTrial} className="flex-1 bg-violet-600 p-3 rounded-xl text-white font-black text-sm shadow-lg">儲存</button>
                            </div>
                        </div>
                    )}

                    {/* Trials list */}
                    <div className="space-y-3">
                        {peakLoading ? (
                            <p className="text-sm text-slate-500 text-center py-8">載入中...</p>
                        ) : trials.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8 bg-slate-900 border-2 border-slate-800 rounded-3xl">尚無巔峰試煉</p>
                        ) : trials.map(trial => (
                            <div key={trial.id} className="bg-slate-900 border-2 border-slate-800 rounded-3xl shadow-xl overflow-hidden">
                                {/* Trial header */}
                                <div className="p-5 flex items-start justify-between gap-3">
                                    <button onClick={() => handleExpandTrial(trial.id)} className="flex-1 text-left flex items-center gap-2">
                                        {expandedTrial === trial.id ? <ChevronDown size={16} className="text-violet-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-500 shrink-0" />}
                                        <div className="min-w-0">
                                            <h3 className="font-black text-white">{trial.title}</h3>
                                            {trial.description && <p className="text-xs text-slate-400 mt-0.5">{trial.description}</p>}
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                {trial.start_date && `${trial.start_date} ~ ${trial.end_date || '?'}`}
                                                {trial.max_participants && ` · 上限 ${trial.max_participants} 人`}
                                            </p>
                                        </div>
                                    </button>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={() => handleToggleTrial(trial.id, !trial.is_active)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${trial.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                                            {trial.is_active ? '啟用中' : '已停用'}
                                        </button>
                                        <button onClick={() => setEditingTrial(trial)}
                                            className="p-1.5 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors text-xs">編輯</button>
                                        <button onClick={() => handleDeleteTrial(trial.id)}
                                            className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
                                            <X size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded: registrations + reviews */}
                                {expandedTrial === trial.id && (
                                    <div className="border-t border-slate-800 p-5 space-y-4">
                                        {regsLoading ? (
                                            <p className="text-sm text-slate-500 text-center py-4">載入報名資料...</p>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 text-xs font-black text-slate-400">
                                                    <Eye size={14} /> 報名人數：{trialRegs.length}
                                                </div>

                                                {/* Registrations */}
                                                {trialRegs.length > 0 && (
                                                    <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-800 max-h-[200px] overflow-y-auto">
                                                        {trialRegs.map(reg => (
                                                            <div key={reg.id} className="flex items-center gap-3 p-3 text-xs">
                                                                <span className="font-bold text-white flex-1">{reg.user_name}</span>
                                                                <span className="text-slate-500">{reg.squad_name}</span>
                                                                <span className="text-[10px] text-slate-600">
                                                                    {new Date(reg.registered_at).toLocaleDateString('zh-TW')}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Reviews */}
                                                {trialReviews.length > 0 && (
                                                    <>
                                                        <div className="flex items-center gap-2 text-xs font-black text-slate-400 mt-4">
                                                            <Mountain size={14} /> 審核提交：{trialReviews.length}
                                                        </div>
                                                        <div className="space-y-2">
                                                            {trialReviews.map(rv => (
                                                                <div key={rv.id} className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="font-bold text-white text-sm">{rv.user_name}</span>
                                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                                                                            rv.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                            rv.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                                                            'bg-amber-500/20 text-amber-400'
                                                                        }`}>
                                                                            {rv.status === 'approved' ? '已核准' : rv.status === 'rejected' ? '已駁回' : '待審核'}
                                                                        </span>
                                                                    </div>
                                                                    {rv.notes && <p className="text-xs text-slate-400">{rv.notes}</p>}
                                                                    {rv.photo_urls && rv.photo_urls.length > 0 && (
                                                                        <div className="flex gap-2 flex-wrap">
                                                                            {rv.photo_urls.map((url, i) => (
                                                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                                                                    className="text-[10px] text-violet-400 underline">照片 {i + 1}</a>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {rv.video_url && (
                                                                        <a href={rv.video_url} target="_blank" rel="noopener noreferrer"
                                                                            className="text-[10px] text-violet-400 underline">影片連結</a>
                                                                    )}
                                                                    {rv.status === 'pending' && (
                                                                        <div className="flex gap-2 pt-1">
                                                                            <button onClick={() => handleReviewSubmission(rv.id, 'rejected')}
                                                                                className="flex-1 py-1.5 bg-red-600/20 text-red-400 font-black rounded-lg text-xs border border-red-600/30">
                                                                                <XCircle size={12} className="inline mr-1" /> 駁回
                                                                            </button>
                                                                            <button onClick={() => handleReviewSubmission(rv.id, 'approved')}
                                                                                className="flex-1 py-1.5 bg-emerald-600 text-white font-black rounded-lg text-xs">
                                                                                <CheckCircle size={12} className="inline mr-1" /> 核准
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}

                                                {trialRegs.length === 0 && trialReviews.length === 0 && (
                                                    <p className="text-sm text-slate-500 text-center py-4">尚無報名或提交</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
