'use client';

import React, { useState, useEffect } from 'react';
import { Users, Zap, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import type { CharacterStats } from '@/types';
import { getAdminDashboardStats, getSquadRankings } from '@/app/actions/admin';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface DashboardModuleProps {
    onBack?: () => void;
}

export function DashboardModule({ onBack }: DashboardModuleProps) {
    const [stats, setStats] = useState<{ totalUsers: number; activeUsers: number; dormantUsers: number } | null>(null);
    const [leaderboard, setLeaderboard] = useState<CharacterStats[]>([]);
    const [squadRankings, setSquadRankings] = useState<{ teamName: string; totalExp: number; memberCount: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'individual' | 'squad'>('individual');

    const loadData = async () => {
        setLoading(true);
        const [statsRes, squadRes, lbRes] = await Promise.all([
            getAdminDashboardStats(),
            getSquadRankings(),
            supabase.from('CharacterStats').select('*').order('Exp', { ascending: false }).limit(50),
        ]);
        if (statsRes.success) {
            setStats({ totalUsers: statsRes.totalUsers, activeUsers: statsRes.activeUsers, dormantUsers: statsRes.dormantUsers });
        }
        if (squadRes.success) setSquadRankings(squadRes.rankings);
        if (lbRes.data) setLeaderboard(lbRes.data as CharacterStats[]);
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const statCards = stats ? [
        { label: '總參與人數', value: stats.totalUsers, sub: '全體修行者', icon: <Users size={24} />, color: 'border-sky-500/30', textColor: 'text-sky-400', iconBg: 'bg-sky-500/20' },
        { label: '活躍人數', value: stats.activeUsers, sub: '近 2 日有回報', icon: <Zap size={24} />, color: 'border-emerald-500/30', textColor: 'text-emerald-400', iconBg: 'bg-emerald-500/20' },
        { label: '沉寂人數', value: stats.dormantUsers, sub: '逾 2 日無動靜', icon: <AlertCircle size={24} />, color: 'border-red-500/30', textColor: 'text-red-400', iconBg: 'bg-red-500/20' },
    ] : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <h2 className="text-xl font-black text-white">儀表板</h2>
                    <p className="text-xs text-slate-500 hidden sm:block">大會管理後台</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black rounded-xl transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 重新整理
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-slate-900 border-2 border-slate-800 p-6 rounded-3xl shadow-xl text-center animate-pulse">
                            <div className="w-12 h-12 bg-slate-800 rounded-full mx-auto mb-3" />
                            <div className="h-4 bg-slate-800 rounded w-20 mx-auto mb-2" />
                            <div className="h-10 bg-slate-800 rounded w-16 mx-auto" />
                        </div>
                    ))
                ) : (
                    statCards.map(card => (
                        <div key={card.label} className={`bg-slate-900 border-2 ${card.color} p-6 rounded-3xl shadow-xl text-center`}>
                            <div className={`w-12 h-12 ${card.iconBg} rounded-full flex items-center justify-center mx-auto mb-3 ${card.textColor}`}>
                                {card.icon}
                            </div>
                            <p className={`text-xs font-bold ${card.textColor}`}>{card.label}</p>
                            <p className="text-4xl font-black text-white mt-1">{card.value}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{card.sub}</p>
                        </div>
                    ))
                )}
            </div>

            {/* Ranking Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setTab('individual')}
                    className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${
                        tab === 'individual' ? 'bg-orange-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                >
                    <Users size={14} className="inline mr-1.5" /> 個人榜
                </button>
                <button
                    onClick={() => setTab('squad')}
                    className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${
                        tab === 'squad' ? 'bg-orange-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                >
                    <Users size={14} className="inline mr-1.5" /> 小隊榜
                </button>
            </div>

            {/* Rankings */}
            <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-4 bg-slate-900 border-b border-slate-800 text-center">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                        {tab === 'individual' ? '個人修為榜' : '小隊修為榜'}
                    </p>
                </div>
                <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-800">
                    {loading ? (
                        <p className="text-sm text-slate-500 text-center py-8">載入中...</p>
                    ) : tab === 'individual' ? (
                        leaderboard.map((p, i) => (
                            <div key={p.UserID} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors">
                                <span className={`text-sm font-black w-7 text-center ${i < 3 ? 'text-orange-400' : 'text-slate-600'}`}>
                                    {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-sm truncate">{p.Name}</p>
                                    <p className="text-[10px] text-slate-500 truncate">{p.Role} · {p.SquadName || '未分組'}{p.TeamName ? ` · ${p.TeamName}` : ''}</p>
                                </div>
                                <p className="text-sm font-black text-orange-500 shrink-0">{(p.Exp || 0).toLocaleString()} <span className="text-[10px] text-slate-500">修為</span></p>
                            </div>
                        ))
                    ) : (
                        squadRankings.map((s, i) => (
                            <div key={s.teamName} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors">
                                <span className={`text-sm font-black w-7 text-center ${i < 3 ? 'text-orange-400' : 'text-slate-600'}`}>
                                    {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-sm truncate">{s.teamName}</p>
                                    <p className="text-[10px] text-slate-500">{s.memberCount} 人</p>
                                </div>
                                <p className="text-sm font-black text-orange-500 shrink-0">{s.totalExp.toLocaleString()} <span className="text-[10px] text-slate-500">修為</span></p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
