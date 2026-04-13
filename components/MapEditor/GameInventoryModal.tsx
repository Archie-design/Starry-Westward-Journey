import React, { useState } from 'react';
import { Package, X, Cpu, Info } from 'lucide-react';
import { IN_GAME_ITEMS } from '@/lib/constants';
import { CharacterStats } from '@/types';

interface GameInventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: CharacterStats;
    onUseItem: (itemId: string) => void;
}

export function GameInventoryModal({ isOpen, onClose, userData, onUseItem }: GameInventoryModalProps) {
    if (!isOpen) return null;

    const inventoryItems = userData.GameInventory || [];

    // Default mock item for testing UI if empty
    const displayItems = inventoryItems.length > 0 ? inventoryItems : [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="p-6 bg-slate-800 shrink-0 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-500/20 p-2.5 rounded-2xl text-indigo-400">
                            <Package size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white leading-none mb-1">冒險背包</h2>
                            <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">
                                Game Inventory
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
                        <Cpu size={16} /> 靈石: {userData.GameGold || 0}
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-4">
                    {displayItems.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold">背包空空如也</p>
                            <p className="text-xs text-slate-600 mt-2">在冒險途中開啟寶箱或尋找商人購買道具吧！</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {displayItems.map((invItem: any) => {
                                const itemConfig = IN_GAME_ITEMS.find(i => i.id === invItem.id);
                                if (!itemConfig) return null;

                                return (
                                    <div key={invItem.id} className="bg-slate-800 p-4 rounded-2xl border border-white/5 flex gap-4 hover:border-indigo-500/50 transition-colors">
                                        <div className="w-16 h-16 bg-slate-950 rounded-xl flex items-center justify-center text-3xl shrink-0">
                                            {itemConfig.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="text-white font-black text-lg truncate">{itemConfig.name}</h3>
                                                <span className="text-xs bg-slate-900 text-slate-300 font-bold px-2 py-1 rounded-lg">x{invItem.count}</span>
                                            </div>
                                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">{itemConfig.desc}</p>

                                            <div className="flex justify-end mt-auto">
                                                <button
                                                    onClick={() => {
                                                        onUseItem(invItem.id);
                                                        onClose();
                                                    }}
                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl active:scale-95 transition-all"
                                                >
                                                    {itemConfig.type === 'exploration' ? '地圖裝備' : '使用'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
