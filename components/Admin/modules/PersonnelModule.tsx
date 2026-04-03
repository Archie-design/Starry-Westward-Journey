'use client';

import React, { useState, useEffect } from 'react';
import { Users, ChevronDown, ChevronRight, Search, Download, Save } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { importRostersData, updateSystemSetting, getPersonnelList, getBattalionSquadTree } from '@/app/actions/admin';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

type SubTab = 'roster' | 'tree' | 'members';

interface MemberRow {
    UserID: string;
    Name: string;
    Role: string;
    Level: number;
    Exp: number;
    TeamName: string;
    SquadName: string;
    IsCaptain: boolean;
    IsCommandant: boolean;
    IsGM: boolean;
    LastCheckIn: string;
    Streak: number;
    TotalFines: number;
}

export function PersonnelModule() {
    const { actorName, showMessage } = useAdmin();
    const [subTab, setSubTab] = useState<SubTab>('roster');

    // Roster state
    const [csvInput, setCsvInput] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [regMode, setRegMode] = useState<'open' | 'roster'>('open');

    // Tree state
    const [tree, setTree] = useState<{ name: string; squads: { name: string; members: any[] }[] }[]>([]);
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
    const [expandedSquads, setExpandedSquads] = useState<Set<string>>(new Set());
    const [treeLoading, setTreeLoading] = useState(false);

    // Members state
    const [members, setMembers] = useState<MemberRow[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTeam, setFilterTeam] = useState('');
    const [filterSquad, setFilterSquad] = useState('');
    const [sortKey, setSortKey] = useState<'Name' | 'Exp' | 'Level' | 'Streak'>('Exp');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Load registration mode
    useEffect(() => {
        supabase.from('SystemSettings').select('*').eq('SettingName', 'RegistrationMode').then(({ data }) => {
            if (data && data.length > 0) setRegMode((data[0].Value as 'open' | 'roster') || 'open');
        });
    }, []);

    // Load tree data when tab switches
    useEffect(() => {
        if (subTab === 'tree' && tree.length === 0) {
            setTreeLoading(true);
            getBattalionSquadTree().then(res => {
                if (res.success) setTree(res.battalions);
                setTreeLoading(false);
            });
        }
    }, [subTab]);

    // Load members when tab switches
    useEffect(() => {
        if (subTab === 'members' && members.length === 0) {
            setMembersLoading(true);
            getPersonnelList().then(res => {
                if (res.success) setMembers(res.members as MemberRow[]);
                setMembersLoading(false);
            });
        }
    }, [subTab]);

    const handleImportSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!csvInput.trim()) return;
        setIsImporting(true);
        try {
            const res = await importRostersData(csvInput, actorName);
            if (res.success) {
                showMessage(`成功匯入！共新增/更新了 ${res.count} 筆名冊資料。`, 'success');
                setCsvInput('');
            } else {
                showMessage(`匯入失敗：${res.error}`, 'error');
            }
        } catch (err: any) {
            showMessage(`系統異常：${err.message}`, 'error');
        } finally {
            setIsImporting(false);
        }
    };

    const handleToggleRegMode = async () => {
        const newMode = regMode === 'roster' ? 'open' : 'roster';
        try {
            const result = await updateSystemSetting('RegistrationMode', newMode);
            if (!(result as any).success) throw new Error((result as any).error);
            setRegMode(newMode);
            showMessage('登入模式已更新。', 'success');
        } catch {
            showMessage('更新登入模式失敗。', 'error');
        }
    };

    // Filter & sort members
    const allTeams = [...new Set(members.map(m => m.TeamName).filter(Boolean))];
    const allSquads = [...new Set(members.filter(m => !filterTeam || m.TeamName === filterTeam).map(m => m.SquadName).filter(Boolean))];

    const filtered = members
        .filter(m => {
            if (searchTerm && !m.Name?.includes(searchTerm) && !m.SquadName?.includes(searchTerm) && !m.TeamName?.includes(searchTerm)) return false;
            if (filterTeam && m.TeamName !== filterTeam) return false;
            if (filterSquad && m.SquadName !== filterSquad) return false;
            return true;
        })
        .sort((a, b) => {
            const av = a[sortKey] ?? 0;
            const bv = b[sortKey] ?? 0;
            if (typeof av === 'string' && typeof bv === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
        });

    const handleSort = (key: typeof sortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const exportCSV = () => {
        const header = '姓名,角色,等級,修為,大隊,小隊,隊長,大隊長,最後打卡,連續天數,罰金';
        const rows = filtered.map(m => [
            m.Name, m.Role, m.Level, m.Exp, m.TeamName, m.SquadName,
            m.IsCaptain ? '是' : '', m.IsCommandant ? '是' : '',
            m.LastCheckIn || '', m.Streak || 0, m.TotalFines || 0,
        ].join(','));
        const csv = [header, ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `人員名單_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const toggleTeam = (name: string) => setExpandedTeams(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
    });
    const toggleSquad = (key: string) => setExpandedSquads(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-black text-white">人員管理</h2>

            {/* Sub-tabs */}
            <div className="flex gap-2 flex-wrap">
                {([
                    { id: 'roster' as SubTab, label: '名冊匯入' },
                    { id: 'tree' as SubTab, label: '分組管理' },
                    { id: 'members' as SubTab, label: '人員名單' },
                ]).map(t => (
                    <button key={t.id} onClick={() => setSubTab(t.id)}
                        className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all ${
                            subTab === t.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* === Roster Import === */}
            {subTab === 'roster' && (
                <section className="space-y-4">
                    <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
                        {/* Login mode toggle */}
                        <div className="space-y-3">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">登入模式</p>
                            <div className={`flex items-center justify-between p-4 rounded-2xl border-2 ${
                                regMode === 'roster' ? 'border-indigo-500/50 bg-indigo-950/30' : 'border-emerald-500/50 bg-emerald-950/30'
                            }`}>
                                <div>
                                    <p className={`font-black text-sm ${regMode === 'roster' ? 'text-indigo-300' : 'text-emerald-300'}`}>
                                        {regMode === 'roster' ? '🔐 名單驗證模式' : '🌐 自由註冊模式'}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                        {regMode === 'roster' ? '僅限名冊內信箱登入' : '任何人可自行填表註冊'}
                                    </p>
                                </div>
                                <button onClick={handleToggleRegMode}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${regMode === 'roster' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'}`}>
                                    切換
                                </button>
                            </div>
                        </div>
                        <div className="border-t border-white/5 pt-4" />
                        <form onSubmit={handleImportSubmit} className="space-y-4">
                            <p className="text-xs text-slate-400">
                                貼上 CSV 格式資料（含表頭行將自動略過）<br />
                                格式：<span className="text-orange-400 font-mono text-[10px]">email, 姓名, 生日(YYYY-MM-DD), 大隊, 小隊, 是否小隊長, 是否大隊長</span>
                            </p>
                            <textarea value={csvInput} onChange={e => setCsvInput(e.target.value)}
                                placeholder={`user1@gmail.com,王小明,1960-03-15,第一大隊,第一小隊,true,false`}
                                className="w-full h-36 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-mono text-xs outline-none focus:border-cyan-500 resize-none" />
                            {csvInput.trim() && (
                                <div className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-[10px] text-slate-400 font-mono">
                                    <span className="text-orange-400 font-black">預覽：</span> 共 {csvInput.trim().split('\n').filter(l => l.trim()).length} 行
                                </div>
                            )}
                            <button disabled={isImporting || !csvInput} className="w-full bg-emerald-600 p-4 rounded-2xl text-white font-black shadow-lg hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50">
                                {isImporting ? '匯入中...' : '📥 批量匯入名冊'}
                            </button>
                        </form>
                    </div>
                </section>
            )}

            {/* === Tree View === */}
            {subTab === 'tree' && (
                <section className="space-y-4">
                    <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-3xl shadow-xl">
                        {treeLoading ? (
                            <p className="text-sm text-slate-500 text-center py-8">載入中...</p>
                        ) : tree.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8">尚無分組資料</p>
                        ) : (
                            <div className="space-y-2">
                                {tree.map(battalion => {
                                    const isOpen = expandedTeams.has(battalion.name);
                                    const totalMembers = battalion.squads.reduce((sum, s) => sum + s.members.length, 0);
                                    return (
                                        <div key={battalion.name} className="border border-slate-800 rounded-2xl overflow-hidden">
                                            <button onClick={() => toggleTeam(battalion.name)}
                                                className="w-full flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left">
                                                {isOpen ? <ChevronDown size={16} className="text-cyan-400" /> : <ChevronRight size={16} className="text-slate-500" />}
                                                <span className="font-black text-white text-sm">{battalion.name}</span>
                                                <span className="text-[10px] text-slate-500 ml-auto">{battalion.squads.length} 小隊 · {totalMembers} 人</span>
                                            </button>
                                            {isOpen && (
                                                <div className="px-4 pb-3 space-y-2 mt-1">
                                                    {battalion.squads.map(squad => {
                                                        const squadKey = `${battalion.name}|${squad.name}`;
                                                        const sqOpen = expandedSquads.has(squadKey);
                                                        return (
                                                            <div key={squad.name} className="border border-slate-700/50 rounded-xl overflow-hidden">
                                                                <button onClick={() => toggleSquad(squadKey)}
                                                                    className="w-full flex items-center gap-3 p-3 bg-slate-900/50 hover:bg-slate-800/50 transition-colors text-left">
                                                                    {sqOpen ? <ChevronDown size={14} className="text-cyan-400" /> : <ChevronRight size={14} className="text-slate-500" />}
                                                                    <span className="font-bold text-slate-200 text-xs">{squad.name}</span>
                                                                    <span className="text-[10px] text-slate-500 ml-auto">{squad.members.length} 人</span>
                                                                </button>
                                                                {sqOpen && (
                                                                    <div className="divide-y divide-slate-800">
                                                                        {squad.members.map((m: any) => (
                                                                            <div key={m.UserID} className="flex items-center gap-3 px-4 py-2 text-xs">
                                                                                <span className="text-slate-300 font-bold flex-1 truncate">
                                                                                    {m.Name}
                                                                                    {m.IsCaptain && <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">隊長</span>}
                                                                                    {m.IsCommandant && <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">大隊長</span>}
                                                                                </span>
                                                                                <span className="text-slate-500 text-[10px]">Lv.{m.Level}</span>
                                                                                <span className="text-orange-400 text-[10px] font-bold">{(m.Exp || 0).toLocaleString()}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* === Members List === */}
            {subTab === 'members' && (
                <section className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                placeholder="搜尋姓名、小隊、大隊..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-white text-xs font-bold outline-none focus:border-cyan-500" />
                        </div>
                        <select value={filterTeam} onChange={e => { setFilterTeam(e.target.value); setFilterSquad(''); }}
                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs font-bold outline-none focus:border-cyan-500">
                            <option value="">全部大隊</option>
                            {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={filterSquad} onChange={e => setFilterSquad(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs font-bold outline-none focus:border-cyan-500">
                            <option value="">全部小隊</option>
                            {allSquads.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={exportCSV}
                            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black rounded-xl transition-colors">
                            <Download size={14} /> CSV
                        </button>
                    </div>

                    <p className="text-[10px] text-slate-500">共 {filtered.length} 筆</p>

                    {/* Table */}
                    <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-800/50 text-slate-400 font-black">
                                        <th className="text-left p-3">#</th>
                                        <th className="text-left p-3 cursor-pointer hover:text-white" onClick={() => handleSort('Name')}>
                                            姓名 {sortKey === 'Name' && (sortDir === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="text-left p-3 hidden sm:table-cell">角色</th>
                                        <th className="text-left p-3 hidden md:table-cell">小隊</th>
                                        <th className="text-center p-3 cursor-pointer hover:text-white" onClick={() => handleSort('Level')}>
                                            等級 {sortKey === 'Level' && (sortDir === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort('Exp')}>
                                            修為 {sortKey === 'Exp' && (sortDir === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="text-center p-3 cursor-pointer hover:text-white hidden sm:table-cell" onClick={() => handleSort('Streak')}>
                                            連續 {sortKey === 'Streak' && (sortDir === 'asc' ? '↑' : '↓')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {membersLoading ? (
                                        <tr><td colSpan={7} className="text-center py-8 text-slate-500">載入中...</td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-8 text-slate-500">無符合條件的成員</td></tr>
                                    ) : filtered.map((m, i) => (
                                        <tr key={m.UserID} className="hover:bg-white/5 transition-colors">
                                            <td className="p-3 text-slate-600 font-bold">{i + 1}</td>
                                            <td className="p-3">
                                                <span className="font-bold text-white">{m.Name}</span>
                                                {m.IsCaptain && <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded">隊長</span>}
                                                {m.IsCommandant && <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded">大隊長</span>}
                                                {m.IsGM && <span className="ml-1 text-[9px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded">GM</span>}
                                            </td>
                                            <td className="p-3 text-slate-400 hidden sm:table-cell">{m.Role}</td>
                                            <td className="p-3 text-slate-400 hidden md:table-cell">{m.SquadName}</td>
                                            <td className="p-3 text-center text-slate-300">{m.Level}</td>
                                            <td className="p-3 text-right text-orange-400 font-bold">{(m.Exp || 0).toLocaleString()}</td>
                                            <td className="p-3 text-center hidden sm:table-cell">
                                                {m.Streak > 0 ? <span className="text-emerald-400 font-bold">{m.Streak}天</span> : <span className="text-slate-600">-</span>}
                                            </td>
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
