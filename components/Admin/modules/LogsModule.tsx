'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import type { AdminLog } from '@/types';
import { getAdminActivityLog, deleteAdminLog } from '@/app/actions/w4';

const ACTION_LABELS: Record<string, string> = {
    temp_quest_add: '新增臨時任務',
    temp_quest_toggle: '切換臨時任務狀態',
    temp_quest_delete: '刪除臨時任務',
    roster_import: '匯入名冊',
    auto_assign_squads: '自動分配大小隊',
    auto_draw_quests: '全服自動抽籤',
    weekly_snapshot: '每週業力結算',
    w3_compliance: 'w3 週罰款結算',
    w4_final_approve: 'w4 終審核准',
    w4_final_reject: 'w4 終審駁回',
    topic_title_update: '更新主題名稱',
};

export function LogsModule() {
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLogs = async () => {
        setLoading(true);
        const res = await getAdminActivityLog(50);
        if (res.success) setLogs(res.logs as AdminLog[]);
        setLoading(false);
    };

    useEffect(() => { loadLogs(); }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('確定刪除此日誌？')) return;
        await deleteAdminLog(id);
        setLogs(prev => prev.filter(l => l.id !== id));
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-black text-white">Log 紀錄</h2>

            <div className="flex items-center gap-2 text-rose-500 font-black text-sm uppercase tracking-widest">
                <FileText size={14} /> 管理操作日誌
            </div>

            <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-xl max-h-[70vh] overflow-y-auto divide-y divide-slate-800">
                {loading ? (
                    <p className="text-sm text-slate-500 text-center py-8">載入中...</p>
                ) : logs.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">尚無操作記錄</p>
                ) : logs.map(log => (
                    <div key={log.id} className={`p-4 hover:bg-white/5 transition-colors group ${log.result === 'error' ? 'bg-red-950/20' : ''}`}>
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-black ${log.result === 'error' ? 'text-red-400' : 'text-slate-200'}`}>
                                    {ACTION_LABELS[log.action] || log.action}
                                </p>
                                {log.actor && <p className="text-[10px] text-slate-500">操作者：{log.actor}</p>}
                                {log.target_name && <p className="text-[10px] text-slate-500 truncate">對象：{log.target_name}</p>}
                                {log.details && (
                                    <p className="text-[10px] text-slate-600 truncate">
                                        {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${log.result === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                        {log.result === 'error' ? '失敗' : '成功'}
                                    </span>
                                    <p className="text-[10px] text-slate-600 mt-1">
                                        {new Date(log.created_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDelete(log.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all"
                                    title="刪除"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
