'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardList, Settings, Save, BookOpen, X, Zap, Plus, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import type { SystemSettings, TopicHistory, TemporaryQuest, BonusQuestRule } from '@/types';
import { TOPIC_PHASES } from '@/lib/constants';
import { getCurrentTopicPhase } from '@/lib/utils/time';
import { useAdmin } from '../AdminContext';
import { updateSystemSetting, logAdminAction, triggerWeeklySnapshot, listBonusQuestRules, upsertBonusQuestRule, deleteBonusQuestRule } from '@/app/actions/admin';
import { autoDrawAllSquads } from '@/app/actions/team';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Danger button with confirmation
function DangerButton({ label, confirmLabel, onConfirm, className }: {
    label: string; confirmLabel: string; onConfirm: () => void; className: string;
}) {
    const [confirming, setConfirming] = useState(false);
    if (confirming) {
        return (
            <div className="flex gap-2">
                <button onClick={() => setConfirming(false)} className="flex-1 bg-slate-700 p-4 rounded-2xl text-slate-300 font-black">取消</button>
                <button onClick={() => { setConfirming(false); onConfirm(); }} className="flex-1 bg-red-600 p-4 rounded-2xl text-white font-black shadow-lg animate-pulse">
                    {confirmLabel}
                </button>
            </div>
        );
    }
    return <button onClick={() => setConfirming(true)} className={className}>{label}</button>;
}

export function TasksModule() {
    const { actorName, showMessage } = useAdmin();
    const [subTab, setSubTab] = useState<'topic' | 'dda' | 'temp' | 'bonus'>('topic');

    // Topic state
    const autoPhase = getCurrentTopicPhase();
    const [topicTitle, setTopicTitle] = useState<string>(autoPhase?.title ?? TOPIC_PHASES[0]?.title ?? '');
    const [currentTopicTitle, setCurrentTopicTitle] = useState('');
    const [topicHistory, setTopicHistory] = useState<TopicHistory[]>([]);

    // DDA state
    const [worldState, setWorldState] = useState('normal');
    const [worldStateMsg, setWorldStateMsg] = useState('環境保持平衡。');
    const [worldStateSaved, setWorldStateSaved] = useState(false);

    // Temp quest state
    const [temporaryQuests, setTemporaryQuests] = useState<TemporaryQuest[]>([]);
    const [loading, setLoading] = useState(true);

    // Bonus rules state
    const [bonusRules, setBonusRules] = useState<BonusQuestRule[]>([]);
    const [bonusLoading, setBonusLoading] = useState(false);
    const [editingRule, setEditingRule] = useState<Partial<BonusQuestRule> | null>(null);
    const [bonusKeywordsInput, setBonusKeywordsInput] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [settingsRes, historyRes, tempQuestsRes] = await Promise.all([
                supabase.from('SystemSettings').select('*'),
                supabase.from('TopicHistory').select('*').order('created_at', { ascending: false }),
                supabase.from('temporaryquests').select('*').order('created_at', { ascending: false }),
            ]);
            if (settingsRes.data) {
                const sObj = settingsRes.data.reduce((acc: any, curr: any) => ({ ...acc, [curr.SettingName]: curr.Value }), {});
                setCurrentTopicTitle(sObj.TopicQuestTitle || '');
                setTopicTitle(autoPhase?.title ?? sObj.TopicQuestTitle ?? TOPIC_PHASES[0]?.title ?? '');
                setWorldState(sObj.WorldState || 'normal');
                setWorldStateMsg(sObj.WorldStateMsg || '環境保持平衡。');
            }
            if (historyRes.data) setTopicHistory(historyRes.data as TopicHistory[]);
            if (tempQuestsRes.data) {
                setTemporaryQuests(tempQuestsRes.data.map((t: any) => ({ ...t, limit: t.limit_count })) as TemporaryQuest[]);
            }
            setLoading(false);
        };
        load();
    }, []);

    const handleSaveTopicTitle = async () => {
        try {
            const result = await updateSystemSetting('TopicQuestTitle', topicTitle);
            if (!(result as any).success) throw new Error((result as any).error);
            setCurrentTopicTitle(topicTitle);
            const { data: newHistory } = await supabase.from('TopicHistory').insert([{ TopicTitle: topicTitle }]).select();
            if (newHistory) setTopicHistory(prev => [newHistory[0] as TopicHistory, ...prev]);
            showMessage('主題已更新。', 'success');
        } catch {
            showMessage('更新主題失敗。', 'error');
        }
    };

    const handleSaveWorldState = async () => {
        try {
            await updateSystemSetting('WorldState', worldState);
            await updateSystemSetting('WorldStateMsg', worldStateMsg);
            setWorldStateSaved(true);
            setTimeout(() => setWorldStateSaved(false), 2000);
            showMessage('共業狀態已儲存。', 'success');
        } catch {
            showMessage('儲存共業狀態失敗。', 'error');
        }
    };

    const handleTriggerSnapshot = async () => {
        try {
            const res = await triggerWeeklySnapshot(actorName);
            if (res.success) {
                setWorldState(res.worldState || worldState);
                setWorldStateMsg(res.message || worldStateMsg);
                showMessage(`結算完成！共業狀態：${res.message}`, 'success');
            } else {
                showMessage('結算失敗: ' + res.error, 'error');
            }
        } catch (e: any) {
            showMessage('系統異常：' + e.message, 'error');
        }
    };

    const handleAutoDrawAllSquads = async () => {
        if (!confirm('確定要為所有本週尚未抽籤的小隊自動抽選推薦定課？')) return;
        try {
            const res = await autoDrawAllSquads(actorName);
            if (res.success) {
                const summary = res.drawn?.map((d: { squadName: string; questName: string }) => `${d.squadName}→${d.questName}`).join('、') || '（無）';
                showMessage(`自動抽籤完成！${res.drawnCount} 個小隊已抽選。\n${summary}`, 'success');
            } else {
                showMessage('自動抽籤失敗：' + res.error, 'error');
            }
        } catch (e: any) {
            showMessage('系統異常：' + e.message, 'error');
        }
    };

    const handleAddTempQuest = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const title = fd.get('title') as string;
        const sub = fd.get('sub') as string;
        const desc = fd.get('desc') as string;
        const reward = parseInt(fd.get('reward') as string, 10);
        if (!title || !reward) return;

        try {
            const id = `temp_${Date.now()}`;
            const dbRow = { id, title, sub, desc, reward, limit_count: 1, active: true };
            const { error } = await supabase.from('temporaryquests').insert([dbRow]);
            if (error) throw error;
            setTemporaryQuests(prev => [{ id, title, sub, desc, reward, limit: 1, active: true }, ...prev]);
            await logAdminAction('temp_quest_add', actorName, id, title, { reward });
            e.currentTarget.reset();
        } catch {
            showMessage('新增臨時任務失敗。', 'error');
        }
    };

    const handleToggleTempQuest = async (id: string, active: boolean) => {
        try {
            const { error } = await supabase.from('temporaryquests').update({ active }).eq('id', id);
            if (error) throw error;
            setTemporaryQuests(prev => prev.map(q => q.id === id ? { ...q, active } : q));
            await logAdminAction('temp_quest_toggle', actorName, id, undefined, { active });
        } catch {
            showMessage('更新臨時任務狀態失敗。', 'error');
        }
    };

    const handleDeleteTempQuest = async (id: string) => {
        if (!confirm('確定要刪除此臨時任務嗎？刪除後無法恢復。')) return;
        try {
            const { error } = await supabase.from('temporaryquests').delete().eq('id', id);
            if (error) throw error;
            setTemporaryQuests(prev => prev.filter(q => q.id !== id));
            await logAdminAction('temp_quest_delete', actorName, id);
        } catch {
            showMessage('刪除臨時任務失敗。', 'error');
        }
    };

    // Bonus rules handlers
    const loadBonusRules = async () => {
        setBonusLoading(true);
        const res = await listBonusQuestRules();
        if (res.success) setBonusRules(res.rules as BonusQuestRule[]);
        setBonusLoading(false);
    };

    useEffect(() => {
        if (subTab === 'bonus' && bonusRules.length === 0) loadBonusRules();
    }, [subTab]);

    const handleSaveBonusRule = async () => {
        if (!editingRule?.name) return;
        const keywords = bonusKeywordsInput.split(',').map(k => k.trim()).filter(Boolean);
        if (keywords.length === 0) { showMessage('請至少輸入一個關鍵字', 'error'); return; }
        try {
            const res = await upsertBonusQuestRule({
                id: editingRule.id,
                name: editingRule.name,
                keywords,
                bonusType: editingRule.bonusType || 'energy',
                bonusAmount: editingRule.bonusAmount || 1,
                active: editingRule.active ?? true,
            });
            if (res.success) {
                showMessage(editingRule.id ? '規則已更新' : '規則已新增', 'success');
                setEditingRule(null);
                setBonusKeywordsInput('');
                loadBonusRules();
            } else {
                showMessage(res.error || '儲存失敗', 'error');
            }
        } catch { showMessage('儲存失敗', 'error'); }
    };

    const handleDeleteBonusRule = async (id: string) => {
        if (!confirm('確定刪除此規則？')) return;
        const res = await deleteBonusQuestRule(id);
        if (res.success) setBonusRules(prev => prev.filter(r => r.id !== id));
        else showMessage(res.error || '刪除失敗', 'error');
    };

    const startEditRule = (rule: BonusQuestRule) => {
        setEditingRule(rule);
        setBonusKeywordsInput(rule.keywords.join(', '));
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-black text-white">任務管理</h2>

            {/* Sub-tabs */}
            <div className="flex gap-2 flex-wrap">
                <button onClick={() => setSubTab('topic')}
                    className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all ${subTab === 'topic' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-900 text-slate-400'}`}>
                    <BookOpen size={14} className="inline mr-1" /> 主題設定
                </button>
                <button onClick={() => setSubTab('dda')}
                    className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all ${subTab === 'dda' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-900 text-slate-400'}`}>
                    <Settings size={14} className="inline mr-1" /> DDA 共業系統
                </button>
                <button onClick={() => setSubTab('temp')}
                    className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all ${subTab === 'temp' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-900 text-slate-400'}`}>
                    <ClipboardList size={14} className="inline mr-1" /> 臨時任務
                    {temporaryQuests.filter(t => t.active).length > 0 && (
                        <span className="ml-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                            {temporaryQuests.filter(t => t.active).length}
                        </span>
                    )}
                </button>
                <button onClick={() => setSubTab('bonus')}
                    className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all ${subTab === 'bonus' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-900 text-slate-400'}`}>
                    <Zap size={14} className="inline mr-1" /> 加分規則
                </button>
            </div>

            {/* Topic Config */}
            {subTab === 'topic' && (
                <section className="space-y-4">
                    <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">雙週加分主題名稱</label>
                            <div className="flex gap-2">
                                <select
                                    value={topicTitle}
                                    onChange={e => setTopicTitle(e.target.value)}
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-orange-500 text-center"
                                >
                                    {TOPIC_PHASES.map(p => (
                                        <option key={p.title} value={p.title}>{p.label}</option>
                                    ))}
                                </select>
                                <button onClick={handleSaveTopicTitle}
                                    className="bg-orange-600 px-5 rounded-2xl text-white font-black hover:bg-orange-500 transition-colors">
                                    <Save size={18} />
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 font-bold">
                                前台目前顯示：<span className="text-yellow-400">「{currentTopicTitle}」</span>
                            </p>
                        </div>
                        {topicHistory.length > 0 && (
                            <div className="bg-slate-950/50 rounded-2xl border border-white/5 overflow-hidden">
                                <div className="p-3 bg-slate-900 border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">歷史主題紀錄</div>
                                <div className="max-h-32 overflow-y-auto divide-y divide-white/5">
                                    {topicHistory.map(h => (
                                        <div key={h.id} className="p-3 text-sm flex justify-between items-center text-slate-300">
                                            <span>{h.TopicTitle}</span>
                                            <span className="text-[10px] text-slate-600">{new Date(h.created_at).toLocaleDateString('zh-TW')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* DDA */}
            {subTab === 'dda' && (
                <section className="space-y-4">
                    <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-3xl space-y-5 shadow-xl">
                        <div className="space-y-3">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">共業狀態</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-500">狀態碼</label>
                                    <select value={worldState} onChange={e => { setWorldState(e.target.value); setWorldStateSaved(false); }}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold outline-none focus:border-orange-500 text-sm">
                                        <option value="normal">normal（平衡）</option>
                                        <option value="blessing">blessing（加持）</option>
                                        <option value="hardship">hardship（試煉）</option>
                                        <option value="chaos">chaos（混沌）</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-slate-500">狀態訊息</label>
                                    <input value={worldStateMsg} onChange={e => { setWorldStateMsg(e.target.value); setWorldStateSaved(false); }}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold outline-none focus:border-orange-500 text-sm" />
                                </div>
                            </div>
                            <button onClick={handleSaveWorldState}
                                className="w-full bg-slate-700 hover:bg-slate-600 p-3 rounded-xl text-white font-black text-sm transition-colors">
                                {worldStateSaved ? '✅ 已儲存' : '儲存共業狀態'}
                            </button>
                        </div>
                        <div className="border-t border-white/5 pt-4 space-y-3">
                            <DangerButton
                                label="🔄 執行每週業力結算 (Weekly Snapshot)"
                                confirmLabel="確認執行結算"
                                onConfirm={handleTriggerSnapshot}
                                className="w-full bg-blue-600 p-4 rounded-2xl text-white font-black shadow-lg hover:bg-blue-500 transition-colors"
                            />
                            <button onClick={handleAutoDrawAllSquads}
                                className="w-full bg-indigo-600 p-4 rounded-2xl text-white font-black shadow-lg hover:bg-indigo-500 transition-colors">
                                🎲 全服自動抽籤（為未抽小隊代選本週定課）
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* Temporary Quests */}
            {subTab === 'temp' && (
                <section className="space-y-4">
                    <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
                        <form onSubmit={handleAddTempQuest} className="space-y-3">
                            <div className="grid grid-cols-1 gap-3">
                                <input name="title" required placeholder="主標題（例：特殊仙緣任務）" className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-orange-500" />
                                <input name="sub" required placeholder="任務名稱（例：跟父母三道菜）" className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-orange-500" />
                                <input name="desc" placeholder="任務說明（例：面對面或視訊皆可）" className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-orange-500" />
                            </div>
                            <div className="flex gap-4 items-center">
                                <input name="reward" type="number" required defaultValue={500} placeholder="加分額度" className="w-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold text-center outline-none focus:border-orange-500" />
                                <button type="submit" className="flex-1 bg-orange-600 p-4 rounded-2xl text-white font-black shadow-lg hover:bg-orange-500 transition-colors">新增臨時任務</button>
                            </div>
                        </form>
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                            {temporaryQuests.length === 0 && (
                                <p className="text-sm text-slate-500 text-center py-4">尚無任務</p>
                            )}
                            {temporaryQuests.map(tq => (
                                <div key={tq.id} className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-slate-200 truncate">{tq.title}</h4>
                                            <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg shrink-0">+{tq.reward}</span>
                                        </div>
                                        {tq.sub && <p className="text-xs text-orange-400 font-bold mt-0.5 truncate">{tq.sub}</p>}
                                        {tq.desc && <p className="text-xs text-slate-500 mt-0.5 truncate">{tq.desc}</p>}
                                    </div>
                                    <div className="flex items-center gap-2 ml-3 shrink-0">
                                        <button onClick={() => handleToggleTempQuest(tq.id, !tq.active)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${tq.active ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/50' : 'bg-slate-800 text-slate-400'}`}>
                                            {tq.active ? '🟢' : '🔴'}
                                        </button>
                                        <button onClick={() => handleDeleteTempQuest(tq.id)}
                                            className="p-1.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Bonus Quest Rules */}
            {subTab === 'bonus' && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-orange-500 font-black text-sm uppercase tracking-widest">
                            <Zap size={14} /> 加分規則管理
                        </div>
                        <button onClick={() => { setEditingRule({ name: '', bonusType: 'energy', bonusAmount: 1, active: true }); setBonusKeywordsInput(''); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black rounded-xl transition-colors">
                            <Plus size={14} /> 新增規則
                        </button>
                    </div>

                    {/* Edit/Add form */}
                    {editingRule && (
                        <div className="bg-slate-900 border-2 border-orange-500/30 p-5 rounded-3xl shadow-xl space-y-4">
                            <p className="text-xs font-black text-orange-400">{editingRule.id ? '編輯規則' : '新增規則'}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input value={editingRule.name || ''} onChange={e => setEditingRule(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="規則名稱" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-orange-500" />
                                <input value={bonusKeywordsInput} onChange={e => setBonusKeywordsInput(e.target.value)}
                                    placeholder="關鍵字（逗號分隔）" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-orange-500" />
                                <select value={editingRule.bonusType || 'energy'} onChange={e => setEditingRule(prev => ({ ...prev, bonusType: e.target.value as 'energy' | 'golden' }))}
                                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-orange-500">
                                    <option value="energy">能量骰子</option>
                                    <option value="golden">黃金骰子</option>
                                </select>
                                <input type="number" value={editingRule.bonusAmount || 1} onChange={e => setEditingRule(prev => ({ ...prev, bonusAmount: parseInt(e.target.value) || 1 }))}
                                    placeholder="數量" min={1} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-orange-500" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingRule(null)} className="flex-1 bg-slate-700 p-3 rounded-xl text-slate-300 font-black text-sm">取消</button>
                                <button onClick={handleSaveBonusRule} className="flex-1 bg-orange-600 p-3 rounded-xl text-white font-black text-sm shadow-lg">儲存</button>
                            </div>
                        </div>
                    )}

                    {/* Rules list */}
                    <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-xl divide-y divide-slate-800">
                        {bonusLoading ? (
                            <p className="text-sm text-slate-500 text-center py-8">載入中...</p>
                        ) : bonusRules.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8">尚無加分規則</p>
                        ) : bonusRules.map(rule => (
                            <div key={rule.id} className="p-4 flex items-center gap-3 hover:bg-white/5 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white text-sm">{rule.name}</span>
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg ${rule.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                                            {rule.active ? '啟用' : '停用'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                        關鍵字：{rule.keywords.join('、')} · {rule.bonusType === 'energy' ? '能量骰子' : '黃金骰子'} +{rule.bonusAmount}
                                    </p>
                                </div>
                                <button onClick={() => startEditRule(rule)} className="p-1.5 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors">
                                    <Pencil size={13} />
                                </button>
                                <button onClick={() => handleDeleteBonusRule(rule.id)} className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
