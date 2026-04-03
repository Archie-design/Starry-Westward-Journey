'use client';

import React from 'react';
import {
    Home, BarChart3, CheckCircle, Users, BookOpen,
    ClipboardList, Dice5, Settings, Image, FileText, X,
} from 'lucide-react';

export type ModuleId =
    | 'home' | 'dashboard' | 'review' | 'personnel'
    | 'course' | 'tasks' | 'monopoly' | 'config'
    | 'gallery' | 'logs';

interface ModuleDef {
    id: ModuleId;
    label: string;
    icon: React.ReactNode;
    color: string;          // Tailwind color name (e.g. 'sky')
    badge?: number;
}

interface AdminShellProps {
    activeModule: ModuleId;
    onModuleChange: (id: ModuleId) => void;
    onClose: () => void;
    actorName?: string;
    badges?: Partial<Record<ModuleId, number>>;
    children: React.ReactNode;
}

const MODULE_DEFS: Omit<ModuleDef, 'badge'>[] = [
    { id: 'home',      label: '首頁',       icon: <Home size={18} />,          color: 'slate' },
    { id: 'dashboard', label: '儀表板',     icon: <BarChart3 size={18} />,     color: 'sky' },
    { id: 'review',    label: '審核中心',   icon: <CheckCircle size={18} />,   color: 'pink' },
    { id: 'personnel', label: '人員管理',   icon: <Users size={18} />,         color: 'cyan' },
    { id: 'course',    label: '課程管理',   icon: <BookOpen size={18} />,      color: 'amber' },
    { id: 'tasks',     label: '任務管理',   icon: <ClipboardList size={18} />, color: 'orange' },
    { id: 'monopoly',  label: '開運大富翁', icon: <Dice5 size={18} />,         color: 'emerald' },
    { id: 'config',    label: '參數管理',   icon: <Settings size={18} />,      color: 'violet' },
    { id: 'gallery',   label: '圖片庫',     icon: <Image size={18} />,         color: 'teal' },
    { id: 'logs',      label: 'Log 紀錄',   icon: <FileText size={18} />,      color: 'rose' },
];

// Map color names to Tailwind classes (can't use dynamic class names)
const COLOR_MAP: Record<string, { active: string; text: string; border: string; bg: string }> = {
    slate:   { active: 'text-white',        text: 'text-slate-400',   border: 'border-white',       bg: 'bg-white/10' },
    sky:     { active: 'text-sky-400',      text: 'text-slate-400',   border: 'border-sky-400',     bg: 'bg-sky-400/10' },
    pink:    { active: 'text-pink-400',     text: 'text-slate-400',   border: 'border-pink-400',    bg: 'bg-pink-400/10' },
    cyan:    { active: 'text-cyan-400',     text: 'text-slate-400',   border: 'border-cyan-400',    bg: 'bg-cyan-400/10' },
    amber:   { active: 'text-amber-400',    text: 'text-slate-400',   border: 'border-amber-400',   bg: 'bg-amber-400/10' },
    orange:  { active: 'text-orange-400',   text: 'text-slate-400',   border: 'border-orange-400',  bg: 'bg-orange-400/10' },
    emerald: { active: 'text-emerald-400',  text: 'text-slate-400',   border: 'border-emerald-400', bg: 'bg-emerald-400/10' },
    violet:  { active: 'text-violet-400',   text: 'text-slate-400',   border: 'border-violet-400',  bg: 'bg-violet-400/10' },
    teal:    { active: 'text-teal-400',     text: 'text-slate-400',   border: 'border-teal-400',    bg: 'bg-teal-400/10' },
    rose:    { active: 'text-rose-400',     text: 'text-slate-400',   border: 'border-rose-400',    bg: 'bg-rose-400/10' },
};

export function AdminShell({ activeModule, onModuleChange, onClose, actorName, badges, children }: AdminShellProps) {
    const modules: ModuleDef[] = MODULE_DEFS.map(m => ({ ...m, badge: badges?.[m.id] }));

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row">
            {/* === Desktop Sidebar === */}
            <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:sticky md:top-0 md:h-screen bg-slate-950 border-r border-slate-800 z-20">
                {/* Header */}
                <div className="p-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white font-black text-sm">
                            <Settings size={20} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-sm font-black text-white truncate">大會管理後台</h1>
                            <p className="text-[10px] text-slate-500">Admin Dashboard</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
                    {modules.map(m => {
                        const isActive = activeModule === m.id;
                        const colors = COLOR_MAP[m.color] || COLOR_MAP.slate;
                        return (
                            <button
                                key={m.id}
                                onClick={() => onModuleChange(m.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                    isActive
                                        ? `${colors.active} ${colors.bg} border-l-2 ${colors.border}`
                                        : `${colors.text} hover:text-white hover:bg-white/5 border-l-2 border-transparent`
                                }`}
                            >
                                <span className={isActive ? colors.active : ''}>{m.icon}</span>
                                <span className="flex-1 text-left truncate">{m.label}</span>
                                {m.badge !== undefined && m.badge > 0 && (
                                    <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                        {m.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 space-y-2">
                    {actorName && (
                        <p className="text-[10px] text-slate-500 truncate">已登入：<span className="text-orange-400 font-bold">{actorName}</span></p>
                    )}
                    <button
                        onClick={onClose}
                        className="w-full flex items-center justify-center gap-2 py-2 text-xs text-slate-500 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-all font-bold"
                    >
                        <X size={14} /> 關閉後台
                    </button>
                </div>
            </aside>

            {/* === Mobile Header + Tabs === */}
            <div className="md:hidden sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800">
                <div className="px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white">
                            <Settings size={16} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-white">大會管理後台</h1>
                            {actorName && <p className="text-[9px] text-orange-400 font-bold">已登入：{actorName}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-900 rounded-lg text-slate-500 border border-slate-800 hover:text-red-400">
                        <X size={16} />
                    </button>
                </div>
                <div className="flex overflow-x-auto gap-1 px-3 pb-2 scrollbar-hide">
                    {modules.map(m => {
                        const isActive = activeModule === m.id;
                        const colors = COLOR_MAP[m.color] || COLOR_MAP.slate;
                        return (
                            <button
                                key={m.id}
                                onClick={() => onModuleChange(m.id)}
                                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-black rounded-xl whitespace-nowrap transition-all shrink-0 ${
                                    isActive
                                        ? `${colors.active} ${colors.bg}`
                                        : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {m.icon}
                                {m.label}
                                {m.badge !== undefined && m.badge > 0 && (
                                    <span className="bg-red-500 text-white text-[8px] font-black px-1 py-0.5 rounded-full min-w-[14px] text-center">
                                        {m.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* === Main Content === */}
            <main className="flex-1 min-w-0 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 pb-20">
                    {children}
                </div>
            </main>
        </div>
    );
}
