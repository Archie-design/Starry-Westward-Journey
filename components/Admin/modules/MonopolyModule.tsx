'use client';

import React, { useState, useEffect } from 'react';
import { Dice5, Save, RefreshCw } from 'lucide-react';
import { useAdmin } from '../AdminContext';

interface MonopolySettings {
    buyRate: number;      // 金幣 → 骰子 匯率
    sellRate: number;     // 骰子 → 金幣 匯率
    multiplier: number;   // 倍率加成
    maxBuyPerDay: number; // 每日購買上限
    enabled: boolean;     // 是否開啟
}

const DEFAULT_SETTINGS: MonopolySettings = {
    buyRate: 100,
    sellRate: 50,
    multiplier: 1,
    maxBuyPerDay: 10,
    enabled: false,
};

export function MonopolyModule() {
    const { showMessage } = useAdmin();
    const [settings, setSettings] = useState<MonopolySettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/monopoly-settings');
            if (res.ok) {
                const data = await res.json();
                if (data.settings) {
                    setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
                }
            }
        } catch {
            // Use defaults
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/monopoly-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });
            if (res.ok) {
                showMessage('大富翁設定已儲存', 'success');
            } else {
                showMessage('儲存失敗', 'error');
            }
        } catch {
            showMessage('儲存失敗', 'error');
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <h2 className="text-xl font-black text-white">開運大富翁</h2>
                <div className="bg-slate-900 border-2 border-slate-800 p-8 rounded-3xl shadow-xl text-center">
                    <RefreshCw size={20} className="animate-spin mx-auto text-slate-500" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">開運大富翁</h2>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all active:scale-95 disabled:opacity-50">
                    <Save size={14} /> {saving ? '儲存中...' : '儲存設定'}
                </button>
            </div>

            <p className="text-xs text-slate-400">管理開運大富翁的匯率、倍率與限制設定</p>

            {/* Enable toggle */}
            <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 shadow-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-black text-white text-sm">功能開關</p>
                        <p className="text-xs text-slate-500 mt-0.5">開啟後玩家可在商城進行骰子買賣</p>
                    </div>
                    <button onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                        className={`w-14 h-8 rounded-full transition-all relative ${settings.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                        <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${settings.enabled ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>
            </div>

            {/* Rate settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                    <div className="flex items-center gap-2">
                        <Dice5 size={18} className="text-emerald-400" />
                        <p className="font-black text-white text-sm">購買匯率</p>
                    </div>
                    <p className="text-xs text-slate-500">每顆骰子需花費的金幣數</p>
                    <div className="flex items-center gap-3">
                        <input type="number" value={settings.buyRate} min={1}
                            onChange={e => setSettings(s => ({ ...s, buyRate: Number(e.target.value) || 1 }))}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold text-center outline-none focus:border-emerald-500" />
                        <span className="text-xs text-slate-500 shrink-0">金幣 / 顆</span>
                    </div>
                </div>

                <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                    <div className="flex items-center gap-2">
                        <Dice5 size={18} className="text-amber-400" />
                        <p className="font-black text-white text-sm">賣出匯率</p>
                    </div>
                    <p className="text-xs text-slate-500">每顆骰子可換回的金幣數</p>
                    <div className="flex items-center gap-3">
                        <input type="number" value={settings.sellRate} min={1}
                            onChange={e => setSettings(s => ({ ...s, sellRate: Number(e.target.value) || 1 }))}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold text-center outline-none focus:border-amber-500" />
                        <span className="text-xs text-slate-500 shrink-0">金幣 / 顆</span>
                    </div>
                </div>

                <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                    <div className="flex items-center gap-2">
                        <Dice5 size={18} className="text-purple-400" />
                        <p className="font-black text-white text-sm">倍率加成</p>
                    </div>
                    <p className="text-xs text-slate-500">大富翁獎勵倍率（1 = 無加成）</p>
                    <div className="flex items-center gap-3">
                        <input type="number" value={settings.multiplier} min={0.1} step={0.1}
                            onChange={e => setSettings(s => ({ ...s, multiplier: Number(e.target.value) || 1 }))}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold text-center outline-none focus:border-purple-500" />
                        <span className="text-xs text-slate-500 shrink-0">倍</span>
                    </div>
                </div>

                <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                    <div className="flex items-center gap-2">
                        <Dice5 size={18} className="text-cyan-400" />
                        <p className="font-black text-white text-sm">每日購買上限</p>
                    </div>
                    <p className="text-xs text-slate-500">每位玩家每日最多可購買的骰子數</p>
                    <div className="flex items-center gap-3">
                        <input type="number" value={settings.maxBuyPerDay} min={1}
                            onChange={e => setSettings(s => ({ ...s, maxBuyPerDay: Number(e.target.value) || 1 }))}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold text-center outline-none focus:border-cyan-500" />
                        <span className="text-xs text-slate-500 shrink-0">顆 / 日</span>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-900 border-2 border-emerald-500/20 rounded-3xl p-5 shadow-xl">
                <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3">目前設定摘要</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-2xl font-black text-white">{settings.buyRate}</p>
                        <p className="text-[10px] text-slate-500">買入價</p>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-white">{settings.sellRate}</p>
                        <p className="text-[10px] text-slate-500">賣出價</p>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-white">×{settings.multiplier}</p>
                        <p className="text-[10px] text-slate-500">倍率</p>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-white">{settings.maxBuyPerDay}</p>
                        <p className="text-[10px] text-slate-500">日限</p>
                    </div>
                </div>
                <div className="mt-3 text-center">
                    <span className={`text-xs font-black px-3 py-1 rounded-full ${settings.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                        {settings.enabled ? '已啟用' : '未啟用'}
                    </span>
                </div>
            </div>
        </div>
    );
}
