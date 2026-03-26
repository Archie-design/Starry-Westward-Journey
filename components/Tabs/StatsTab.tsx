import React from 'react';
import { Skull, Sparkles, Shield, Heart, Brain, Zap, Trophy, Coins, Cake } from 'lucide-react';
import { CharacterStats } from '@/types';

interface StatCardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
}

export const StatCard = ({ label, value, icon, color }: StatCardProps) => (
    <div className="bg-slate-900 border-2 border-slate-800 p-5 rounded-4xl shadow-xl text-left">
        <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase ml-1">{label}</span>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-4xl font-black text-white">{value || 0}</span>
            <div className="h-2.5 flex-1 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <div
                    className={`h-full ${color} opacity-70 transition-all duration-1000`}
                    style={{ width: `${Math.min(100, ((value || 0) / 50) * 100)}%` }}
                ></div>
            </div>
        </div>
    </div>
);

interface StatsTabProps {
    userData: CharacterStats;
    roleTrait: { isCursed: boolean; curseName: string; curseEffect: string; talent: string } | null;
}

export function StatsTab({ userData, roleTrait }: StatsTabProps) {
    if (!roleTrait) return null;

    // Normalize Birthday: DB may store ISO "1991-09-18" or full Date.toString() string
    const birthdayDate = userData.Birthday ? new Date(userData.Birthday) : null;
    const birthdayDisplay = birthdayDate && !isNaN(birthdayDate.getTime())
        ? birthdayDate.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
        : null;
    const displayAge = birthdayDate && !isNaN(birthdayDate.getTime())
        ? Math.floor((Date.now() - birthdayDate.getTime()) / (365.25 * 24 * 3600 * 1000))
        : null;

    return (
        <div className="space-y-8 animate-in zoom-in-95 duration-500 mx-auto text-center">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-yellow-900/40 to-slate-900 border-2 border-yellow-500/20 p-6 rounded-4xl shadow-2xl text-center flex flex-col items-center justify-center">
                    <Coins className="text-yellow-500 mb-2" size={24} />
                    <span className="text-4xl font-black text-yellow-500 mb-1">{userData.Coins || 0}</span>
                    <p className="text-[10px] text-yellow-500/70 font-black uppercase tracking-[0.2em]">天庭金幣餘額</p>
                </div>

                <div className="bg-gradient-to-br from-red-950/40 to-slate-900 border-2 border-white/5 p-6 rounded-4xl shadow-2xl text-center flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center mb-2 mx-auto"><Skull className="text-red-500" size={16} /></div>
                    <span className="text-4xl font-black text-white mb-1">
                        {Math.max(0, (userData.TotalFines || 0) - (userData.FinePaid || 0))}
                    </span>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">罰金餘額</p>
                    <p className="text-[9px] text-slate-600 mt-1">
                        累計 NT${userData.TotalFines || 0}　已繳 NT${userData.FinePaid || 0}
                    </p>
                </div>

            </div>

            {/* Birthday card — read-only, set by admin via roster import */}
            <div className="bg-slate-900 border-2 border-slate-800 p-5 rounded-4xl shadow-xl text-left">
                <div className="flex items-center gap-2 mb-3">
                    <Cake size={16} className="text-pink-400" />
                    <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase ml-1">生日（金剛杖資格驗證）</span>
                </div>
                <span className="text-white font-bold">
                    {birthdayDisplay
                        ? `${birthdayDisplay}（${displayAge} 歲）`
                        : <span className="text-slate-500">尚未設定</span>}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-5 text-center mx-auto">
                <StatCard label="神識 (Spirit)" value={userData.Spirit} icon={<Sparkles size={16} className="text-purple-400" />} color="bg-purple-500" />
                <StatCard label="根骨 (Physique)" value={userData.Physique} icon={<Shield size={16} className="text-red-400" />} color="bg-red-500" />
                <StatCard label="魅力 (Charisma)" value={userData.Charisma} icon={<Heart size={16} className="text-pink-400" />} color="bg-pink-500" />
                <StatCard label="悟性 (Savvy)" value={userData.Savvy} icon={<Brain size={16} className="text-blue-400" />} color="bg-blue-500" />
                <StatCard label="機緣 (Luck)" value={userData.Luck} icon={<Zap size={16} className="text-emerald-400" />} color="bg-emerald-500" />
                <StatCard label="潛力 (Potential)" value={userData.Potential} icon={<Trophy size={16} className="text-yellow-400" />} color="bg-yellow-500" />
            </div>
        </div>
    );
}
