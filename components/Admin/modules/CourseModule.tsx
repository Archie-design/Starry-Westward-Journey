'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, Save, BookOpen, Download, Search, CheckCircle, Clock } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useAdmin } from '../AdminContext';
import { updateSystemSetting, getCourseRegistrations } from '@/app/actions/admin';
import { COURSE_INFO, type CourseKey } from '@/lib/courseConfig';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

type SubTab = 'courses' | 'registrations' | 'volunteer';

interface RegistrationRow {
    id: string;
    userId: string;
    userName: string;
    teamName: string;
    squadName: string;
    registeredAt: string;
    attended: boolean;
    attendedAt: string | null;
    scannedBy: string | null;
}

export function CourseModule() {
    const { showMessage } = useAdmin();
    const [subTab, setSubTab] = useState<SubTab>('courses');

    // Volunteer state
    const [volunteerPwd, setVolunteerPwd] = useState('');
    const [volPwdSaved, setVolPwdSaved] = useState(false);
    const [currentPwdStatus, setCurrentPwdStatus] = useState<boolean | null>(null);

    // Registration state
    const [selectedCourse, setSelectedCourse] = useState<CourseKey | null>(null);
    const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
    const [regLoading, setRegLoading] = useState(false);
    const [regSearch, setRegSearch] = useState('');
    const [regFilter, setRegFilter] = useState<'all' | 'attended' | 'not_attended'>('all');

    useEffect(() => {
        supabase.from('SystemSettings').select('*').eq('SettingName', 'VolunteerPassword').then(({ data }) => {
            setCurrentPwdStatus(data && data.length > 0 && !!data[0].Value);
        });
    }, []);

    const handleSaveVolunteerPwd = async () => {
        if (!volunteerPwd.trim()) return;
        try {
            const result = await updateSystemSetting('VolunteerPassword', volunteerPwd.trim());
            if (!(result as any).success) throw new Error((result as any).error);
            setVolPwdSaved(true);
            setCurrentPwdStatus(true);
            showMessage('志工密碼已儲存。', 'success');
        } catch {
            showMessage('儲存志工密碼失敗。', 'error');
        }
    };

    const handleLoadRegistrations = async (courseKey: CourseKey) => {
        setSelectedCourse(courseKey);
        setRegLoading(true);
        const res = await getCourseRegistrations(courseKey);
        if (res.success) setRegistrations(res.registrations as RegistrationRow[]);
        else showMessage(res.error || '載入失敗', 'error');
        setRegLoading(false);
    };

    const filteredRegs = registrations
        .filter(r => {
            if (regSearch && !r.userName.includes(regSearch) && !r.teamName.includes(regSearch) && !r.squadName.includes(regSearch)) return false;
            if (regFilter === 'attended' && !r.attended) return false;
            if (regFilter === 'not_attended' && r.attended) return false;
            return true;
        });

    const exportRegCSV = () => {
        const course = selectedCourse ? COURSE_INFO[selectedCourse] : null;
        const header = '大隊,小隊,姓名,報名時間,報到狀態,報到時間,掃碼者';
        const rows = filteredRegs.map(r => [
            r.teamName, r.squadName, r.userName,
            new Date(r.registeredAt).toLocaleString('zh-TW'),
            r.attended ? '已報到' : '未報到',
            r.attendedAt ? new Date(r.attendedAt).toLocaleString('zh-TW') : '',
            r.scannedBy || '',
        ].join(','));
        const csv = [header, ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${course?.name || selectedCourse}_報名名單.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const courses = Object.entries(COURSE_INFO) as [CourseKey, typeof COURSE_INFO[CourseKey]][];

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-black text-white">課程管理</h2>

            {/* Sub-tabs */}
            <div className="flex gap-2 flex-wrap">
                {([
                    { id: 'courses' as SubTab, label: '課程列表' },
                    { id: 'registrations' as SubTab, label: '報名查詢' },
                    { id: 'volunteer' as SubTab, label: '志工授權' },
                ]).map(t => (
                    <button key={t.id} onClick={() => setSubTab(t.id)}
                        className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all ${
                            subTab === t.id ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* === Course List === */}
            {subTab === 'courses' && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-500 font-black text-sm uppercase tracking-widest">
                        <BookOpen size={14} /> 課程列表
                    </div>
                    <div className="space-y-3">
                        {courses.map(([key, info]) => (
                            <div key={key} className="bg-slate-900 border-2 border-slate-800 p-5 rounded-3xl shadow-xl">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-black text-white">{info.name}</h3>
                                        <p className="text-xs text-slate-400 mt-1">{info.dateDisplay}</p>
                                        <p className="text-xs text-slate-500">{info.time} · {info.location}</p>
                                    </div>
                                    <span className="text-[10px] font-black text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg">{key}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* === Registration Query === */}
            {subTab === 'registrations' && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-500 font-black text-sm uppercase tracking-widest">
                        <BookOpen size={14} /> 報名名單查詢
                    </div>

                    {/* Course selector */}
                    <div className="flex gap-2 flex-wrap">
                        {courses.map(([key, info]) => (
                            <button key={key} onClick={() => handleLoadRegistrations(key)}
                                className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all ${
                                    selectedCourse === key
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                                }`}>
                                {info.name}
                            </button>
                        ))}
                    </div>

                    {selectedCourse && (
                        <>
                            {/* Filters */}
                            <div className="flex flex-wrap gap-2">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input value={regSearch} onChange={e => setRegSearch(e.target.value)}
                                        placeholder="搜尋姓名、大隊、小隊..."
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-white text-xs font-bold outline-none focus:border-amber-500" />
                                </div>
                                <select value={regFilter} onChange={e => setRegFilter(e.target.value as typeof regFilter)}
                                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs font-bold outline-none">
                                    <option value="all">全部</option>
                                    <option value="attended">已報到</option>
                                    <option value="not_attended">未報到</option>
                                </select>
                                <button onClick={exportRegCSV}
                                    className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black rounded-xl transition-colors">
                                    <Download size={14} /> CSV
                                </button>
                            </div>

                            <p className="text-[10px] text-slate-500">
                                共 {filteredRegs.length} 筆 · 已報到 {filteredRegs.filter(r => r.attended).length} 人
                            </p>

                            {/* Table */}
                            <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                                <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-slate-800/90 backdrop-blur">
                                            <tr className="text-slate-400 font-black">
                                                <th className="text-left p-3">#</th>
                                                <th className="text-left p-3">姓名</th>
                                                <th className="text-left p-3 hidden sm:table-cell">大隊</th>
                                                <th className="text-left p-3 hidden sm:table-cell">小隊</th>
                                                <th className="text-center p-3">報到</th>
                                                <th className="text-left p-3 hidden md:table-cell">報名時間</th>
                                                <th className="text-left p-3 hidden md:table-cell">報到時間</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {regLoading ? (
                                                <tr><td colSpan={7} className="text-center py-8 text-slate-500">載入中...</td></tr>
                                            ) : filteredRegs.length === 0 ? (
                                                <tr><td colSpan={7} className="text-center py-8 text-slate-500">無報名記錄</td></tr>
                                            ) : filteredRegs.map((r, i) => (
                                                <tr key={r.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-3 text-slate-600">{i + 1}</td>
                                                    <td className="p-3 font-bold text-white">{r.userName}</td>
                                                    <td className="p-3 text-slate-400 hidden sm:table-cell">{r.teamName}</td>
                                                    <td className="p-3 text-slate-400 hidden sm:table-cell">{r.squadName}</td>
                                                    <td className="p-3 text-center">
                                                        {r.attended
                                                            ? <CheckCircle size={16} className="text-emerald-400 mx-auto" />
                                                            : <Clock size={16} className="text-slate-600 mx-auto" />}
                                                    </td>
                                                    <td className="p-3 text-slate-500 hidden md:table-cell">
                                                        {new Date(r.registeredAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="p-3 text-slate-500 hidden md:table-cell">
                                                        {r.attendedAt ? new Date(r.attendedAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            )}

            {/* === Volunteer QR Auth === */}
            {subTab === 'volunteer' && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-500 font-black text-sm uppercase tracking-widest">
                        <QrCode size={14} /> 志工掃碼授權
                    </div>
                    <div className="bg-slate-900 border-2 border-amber-500/20 p-6 rounded-3xl space-y-4 shadow-xl">
                        <p className="text-xs text-slate-400">設定志工專屬密碼，讓報到志工可在主頁「課程」分頁輸入密碼後開啟掃碼介面，無需管理員帳號。</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>目前狀態：</span>
                            {currentPwdStatus === null ? (
                                <span className="text-slate-500">載入中...</span>
                            ) : currentPwdStatus ? (
                                <span className="text-teal-400 font-black">已設定</span>
                            ) : (
                                <span className="text-slate-500 font-black">尚未設定</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input type="password" value={volunteerPwd}
                                onChange={e => { setVolunteerPwd(e.target.value); setVolPwdSaved(false); }}
                                placeholder="輸入新的志工密碼"
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-amber-500" />
                            <button onClick={handleSaveVolunteerPwd} disabled={!volunteerPwd.trim()}
                                className="bg-amber-600 px-6 rounded-2xl text-white font-black hover:bg-amber-500 transition-colors disabled:opacity-40">
                                <Save size={18} />
                            </button>
                        </div>
                        {volPwdSaved && <p className="text-xs text-teal-400 font-bold text-center">志工密碼已儲存</p>}
                    </div>
                </section>
            )}
        </div>
    );
}
