import React, { useState } from 'react';
import { Store, X, Coins, Info } from 'lucide-react';
import { IN_GAME_ITEMS } from '@/lib/constants';
import { CharacterStats } from '@/types';

interface NPCShopModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: CharacterStats;
    onBuyItem: (itemId: string, price: number) => void;
}

export function NPCShopModal({ isOpen, onClose, userData, onBuyItem }: NPCShopModalProps) {
    if (!isOpen) return null;

    const gameGold = userData.GameGold || 0;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="p-6 bg-slate-800 shrink-0 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-500/20 p-2.5 rounded-2xl text-orange-400">
                            <Store size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white leading-none mb-1">雲遊商人</h2>
                            <p className="text-xs text-orange-400 font-bold uppercase tracking-widest">
                                Mystery Merchant
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-slate-950/50 p-3 rounded-2xl text-slate-400 hover:text-white transition-colors border border-white/5"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="bg-slate-950 px-6 py-3 flex items-center justify-between shrink-0 border-b border-white/5">
                    <div className="flex items-center gap-2 text-yellow-500 font-black text-sm">
                        <Coins size={16} /> 您持有的靈石: <span className="text-white ml-1">{gameGold}</span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        {IN_GAME_ITEMS.map((item) => {
                            const canAfford = gameGold >= item.price;

                            return (
                                <div key={item.id} className={`bg-slate-800 p-4 rounded-2xl border flex gap-4 transition-colors ${canAfford ? 'border-white/5 hover:border-orange-500/50' : 'border-red-900/30 opacity-60'}`}>
                                    <div className="w-16 h-16 bg-slate-950 rounded-xl flex items-center justify-center text-3xl shrink-0">
                                        {item.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="text-white font-black text-lg truncate">{item.name}</h3>
                                            <span className={`text-xs font-black px-2 py-1 rounded-lg flex items-center gap-1 ${canAfford ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>
                                                <Coins size={12} /> {item.price}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">{item.desc}</p>

                                        <div className="flex justify-end mt-auto gap-2">
                                            <span className="text-[10px] text-slate-500 font-bold self-end mb-1 mr-2 px-2">類型: {item.type.toUpperCase()}</span>
                                            <button
                                                onClick={() => onBuyItem(item.id, item.price)}
                                                disabled={!canAfford}
                                                className={`px-4 py-2 text-white text-xs font-black rounded-xl transition-all ${canAfford ? 'bg-orange-600 hover:bg-orange-500 active:scale-95 shadow-lg' : 'bg-slate-700 text-slate-500 cursor-not-allowed border border-white/5'}`}
                                            >
                                                買入
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
