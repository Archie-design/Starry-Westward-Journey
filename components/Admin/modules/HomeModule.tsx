'use client';

import React from 'react';
import {
    BarChart3, CheckCircle, Users, BookOpen,
    ClipboardList, Dice5, Settings, Image, FileText,
} from 'lucide-react';
import type { ModuleId } from '../AdminShell';

interface HomeModuleProps {
    onNavigate: (id: ModuleId) => void;
    badges?: Partial<Record<ModuleId, number>>;
}

const CARDS: { id: ModuleId; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    { id: 'dashboard', label: '儀表板',     desc: '查看整體統計與排行',       icon: <BarChart3 size={28} />,     color: 'sky' },
    { id: 'review',    label: '審核中心',   desc: '傳愛終審、親證故事',       icon: <CheckCircle size={28} />,   color: 'pink' },
    { id: 'personnel', label: '人員管理',   desc: '名冊匯入、分組管理',       icon: <Users size={28} />,         color: 'cyan' },
    { id: 'course',    label: '課程管理',   desc: '課程查詢、志工授權',       icon: <BookOpen size={28} />,      color: 'amber' },
    { id: 'tasks',     label: '任務管理',   desc: '主題設定、臨時任務、DDA',  icon: <ClipboardList size={28} />, color: 'orange' },
    { id: 'monopoly',  label: '開運大富翁', desc: '匯率與倍率設定',           icon: <Dice5 size={28} />,         color: 'emerald' },
    { id: 'config',    label: '參數管理',   desc: '定課、道具、成就設定',     icon: <Settings size={28} />,      color: 'violet' },
    { id: 'gallery',   label: '圖片庫',     desc: '上傳與管理圖片素材',       icon: <Image size={28} />,         color: 'teal' },
    { id: 'logs',      label: 'Log 紀錄',   desc: '管理操作歷史紀錄',         icon: <FileText size={28} />,      color: 'rose' },
];

const BG_MAP: Record<string, string> = {
    sky:     'border-sky-500/20 hover:border-sky-500/40 hover:bg-sky-500/5',
    pink:    'border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5',
    cyan:    'border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/5',
    amber:   'border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5',
    orange:  'border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/5',
    emerald: 'border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5',
    violet:  'border-violet-500/20 hover:border-violet-500/40 hover:bg-violet-500/5',
    teal:    'border-teal-500/20 hover:border-teal-500/40 hover:bg-teal-500/5',
    rose:    'border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-500/5',
};

const ICON_MAP: Record<string, string> = {
    sky: 'text-sky-400', pink: 'text-pink-400', cyan: 'text-cyan-400',
    amber: 'text-amber-400', orange: 'text-orange-400', emerald: 'text-emerald-400',
    violet: 'text-violet-400', teal: 'text-teal-400', rose: 'text-rose-400',
};

export function HomeModule({ onNavigate, badges }: HomeModuleProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-black text-white">歡迎回來，管理員</h2>
            <p className="text-sm text-slate-400">選擇一個模組開始管理</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {CARDS.map(card => {
                    const badge = badges?.[card.id];
                    return (
                        <button
                            key={card.id}
                            onClick={() => onNavigate(card.id)}
                            className={`relative bg-slate-900 border-2 ${BG_MAP[card.color] || ''} p-6 rounded-3xl text-left transition-all active:scale-[0.98] shadow-xl group`}
                        >
                            {badge !== undefined && badge > 0 && (
                                <span className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {badge}
                                </span>
                            )}
                            <div className={`${ICON_MAP[card.color] || 'text-slate-400'} mb-4`}>
                                {card.icon}
                            </div>
                            <h3 className="text-lg font-black text-white group-hover:text-white/90">{card.label}</h3>
                            <p className="text-xs text-slate-500 mt-1">{card.desc}</p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
