'use client';

import React, { useState } from 'react';
import { Settings, Sword, Shield, Award, Users, MessageSquare } from 'lucide-react';
import { DAILY_QUEST_CONFIG, WEEKLY_QUEST_CONFIG, IN_GAME_ITEMS, ARTIFACTS_CONFIG, ROLE_CURE_MAP, ROLE_GROWTH_RATES } from '@/lib/constants';
import { ACHIEVEMENTS } from '@/lib/achievements';

type SubTab = 'quests' | 'items' | 'artifacts' | 'achievements' | 'roles' | 'growth';

const RARITY_COLORS: Record<string, string> = {
    common: 'text-orange-400', rare: 'text-slate-200', epic: 'text-yellow-300', legendary: 'text-purple-300',
};

export function ConfigModule() {
    const [subTab, setSubTab] = useState<SubTab>('quests');

    const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
        { id: 'quests', label: '定課設定', icon: <Settings size={14} /> },
        { id: 'items', label: '遊戲道具', icon: <Sword size={14} /> },
        { id: 'artifacts', label: '神器法寶', icon: <Shield size={14} /> },
        { id: 'achievements', label: '成就系統', icon: <Award size={14} /> },
        { id: 'roles', label: '角色屬性', icon: <Users size={14} /> },
        { id: 'growth', label: '成長率', icon: <MessageSquare size={14} /> },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-black text-white">參數管理</h2>

            {/* Sub-tabs */}
            <div className="flex gap-2 flex-wrap">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setSubTab(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-xl transition-all ${
                            subTab === t.id ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* === Daily & Weekly Quests === */}
            {subTab === 'quests' && (
                <div className="space-y-6">
                    <section className="space-y-3">
                        <p className="text-xs font-black text-violet-400 uppercase tracking-widest">日課設定（q1–q9）</p>
                        <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                            <table className="w-full text-xs">
                                <thead><tr className="bg-slate-800/50 text-slate-400 font-black">
                                    <th className="p-3 text-left">ID</th><th className="p-3 text-left">名稱</th><th className="p-3 text-left">副標</th><th className="p-3 text-right">修為</th><th className="p-3 text-right">骰子</th>
                                </tr></thead>
                                <tbody className="divide-y divide-slate-800">
                                    {DAILY_QUEST_CONFIG.map(q => (
                                        <tr key={q.id} className="hover:bg-white/5">
                                            <td className="p-3 text-slate-500 font-mono">{q.id}</td>
                                            <td className="p-3 text-white font-bold">{q.title}</td>
                                            <td className="p-3 text-slate-400">{q.sub}</td>
                                            <td className="p-3 text-right text-orange-400 font-bold">{q.reward}</td>
                                            <td className="p-3 text-right text-slate-300">{q.dice || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                    <section className="space-y-3">
                        <p className="text-xs font-black text-violet-400 uppercase tracking-widest">週課設定（w1–w4）</p>
                        <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                            <table className="w-full text-xs">
                                <thead><tr className="bg-slate-800/50 text-slate-400 font-black">
                                    <th className="p-3 text-left">ID</th><th className="p-3 text-left">名稱</th><th className="p-3 text-left">副標</th><th className="p-3 text-right">修為</th><th className="p-3 text-right">上限</th>
                                </tr></thead>
                                <tbody className="divide-y divide-slate-800">
                                    {WEEKLY_QUEST_CONFIG.map(q => (
                                        <tr key={q.id} className="hover:bg-white/5">
                                            <td className="p-3 text-slate-500 font-mono">{q.id}</td>
                                            <td className="p-3 text-white font-bold">{q.icon} {q.title}</td>
                                            <td className="p-3 text-slate-400">{q.sub}</td>
                                            <td className="p-3 text-right text-orange-400 font-bold">{q.reward}</td>
                                            <td className="p-3 text-right text-slate-300">{q.limit || '∞'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}

            {/* === Game Items === */}
            {subTab === 'items' && (
                <section className="space-y-3">
                    <p className="text-xs font-black text-violet-400 uppercase tracking-widest">遊戲道具（i1–i10）</p>
                    <div className="space-y-2">
                        {IN_GAME_ITEMS.map(item => (
                            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start gap-3 hover:bg-white/5 transition-colors">
                                <span className="text-2xl">{item.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-white text-sm">{item.name}</span>
                                        <span className="text-[10px] font-mono text-slate-500">{item.id}</span>
                                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{item.type}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                                </div>
                                <span className="text-xs font-black text-amber-400 shrink-0">{item.price} 金</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* === Artifacts === */}
            {subTab === 'artifacts' && (
                <section className="space-y-3">
                    <p className="text-xs font-black text-violet-400 uppercase tracking-widest">神器法寶（a1–a6）</p>
                    <div className="space-y-2">
                        {ARTIFACTS_CONFIG.map(art => (
                            <div key={art.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:bg-white/5 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-white text-sm">{art.name}</span>
                                        <span className="text-[10px] font-mono text-slate-500">{art.id}</span>
                                        {art.isTeamBinding && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">團隊</span>}
                                    </div>
                                    <span className="text-xs font-black text-amber-400">{art.price > 0 ? `${art.price} 幣` : '免費'}</span>
                                </div>
                                <p className="text-xs text-emerald-400 mt-1">{art.effect}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{art.description}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* === Achievements === */}
            {subTab === 'achievements' && (
                <section className="space-y-3">
                    <p className="text-xs font-black text-violet-400 uppercase tracking-widest">成就系統（{ACHIEVEMENTS.length} 項）</p>
                    <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-xl max-h-[60vh] overflow-y-auto divide-y divide-slate-800">
                        {ACHIEVEMENTS.map(ach => (
                            <div key={ach.id} className="p-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
                                <span className="text-xl w-8 text-center">{ach.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold text-sm ${RARITY_COLORS[ach.rarity] || 'text-white'}`}>{ach.name}</span>
                                        <span className="text-[9px] text-slate-600 font-mono">{ach.id}</span>
                                        {ach.roleExclusive && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded">{ach.roleExclusive}</span>}
                                    </div>
                                    <p className="text-[10px] text-slate-500 truncate">{ach.description}</p>
                                </div>
                                <span className={`text-[10px] font-black ${RARITY_COLORS[ach.rarity] || ''}`}>
                                    {ach.rarity === 'common' ? '常見' : ach.rarity === 'rare' ? '罕見' : ach.rarity === 'epic' ? '稀有' : '傳說'}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* === Roles === */}
            {subTab === 'roles' && (
                <section className="space-y-3">
                    <p className="text-xs font-black text-violet-400 uppercase tracking-widest">角色設定</p>
                    <div className="space-y-3">
                        {Object.entries(ROLE_CURE_MAP).map(([role, info]) => (
                            <div key={role} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">{info.avatar}</span>
                                    <span className="font-black text-white text-lg">{role}</span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${info.color} text-white`}>{info.poison}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div><span className="text-slate-500">天命對治：</span><span className="text-emerald-400">{info.cureTaskId}</span></div>
                                    <div><span className="text-slate-500">加成屬性：</span><span className="text-orange-400">{info.bonusStat}</span></div>
                                    <div className="col-span-2"><span className="text-slate-500">天賦：</span><span className="text-cyan-400">{info.talent}</span></div>
                                    <div className="col-span-2"><span className="text-slate-500">詛咒：</span><span className="text-red-400">{info.curseName} — {info.curseEffect}</span></div>
                                    <div><span className="text-slate-500">基礎 HP：</span><span className="text-white">{info.baseHP}</span></div>
                                    <div><span className="text-slate-500">基礎 DEF：</span><span className="text-white">{info.baseDEF}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* === Growth Rates === */}
            {subTab === 'growth' && (
                <section className="space-y-3">
                    <p className="text-xs font-black text-violet-400 uppercase tracking-widest">角色成長率（每升級加成）</p>
                    <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead><tr className="bg-slate-800/50 text-slate-400 font-black">
                                    <th className="p-3 text-left">角色</th>
                                    <th className="p-3 text-center">根骨</th><th className="p-3 text-center">潛能</th>
                                    <th className="p-3 text-center">魅力</th><th className="p-3 text-center">氣運</th>
                                    <th className="p-3 text-center">悟性</th><th className="p-3 text-center">神識</th>
                                </tr></thead>
                                <tbody className="divide-y divide-slate-800">
                                    {Object.entries(ROLE_GROWTH_RATES).map(([role, rates]) => (
                                        <tr key={role} className="hover:bg-white/5">
                                            <td className="p-3 font-black text-white">{role}</td>
                                            {(['Physique', 'Potential', 'Charisma', 'Luck', 'Savvy', 'Spirit'] as const).map(stat => {
                                                const val = (rates as any)[stat] || 0;
                                                return (
                                                    <td key={stat} className={`p-3 text-center font-bold ${val >= 3 ? 'text-orange-400' : val > 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                                                        {val > 0 ? `+${val}` : '-'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
