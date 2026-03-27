import React from 'react';
import {
  Edit3, Save, Layers, Maximize2, Heart,
  Navigation, PaintBucket, Dices, LayoutGrid, AlertTriangle
} from 'lucide-react';
import { ZoneInfo } from '@/types';
import { ZONES, TERRAIN_TYPES } from '@/lib/constants';

interface SidebarProps {
  view: 'world' | 'editor';
  setView: (view: 'world' | 'editor') => void;
  selectedZone: ZoneInfo | { id: string, name: string } | null;
  setSelectedZone: (zone: ZoneInfo | { id: string, name: string }) => void;
  selectedSubZoneIdx: number;
  setSelectedSubZoneIdx: (idx: number) => void;
  corridorL: number;
  setCorridorL: (l: number) => void;
  setSyncStatus: (status: string) => void;
  brush: string;
  setBrush: (b: string) => void;
  handleRandomize: () => void;
  handleFillAll: () => void;
  saveMapToCloud: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  view, setView,
  selectedZone, setSelectedZone,
  selectedSubZoneIdx, setSelectedSubZoneIdx,
  corridorL, setCorridorL, setSyncStatus,
  brush, setBrush,
  handleRandomize, handleFillAll,
  saveMapToCloud
}) => {
  return (
    <aside className="w-80 bg-slate-950/60 border-r border-white/5 p-7 backdrop-blur-md z-20 flex flex-col shadow-2xl overflow-y-auto">
      {view === 'world' ? (
        <div className="space-y-8 flex-1 flex flex-col">
          <section className="p-5 bg-white/5 rounded-3xl border border-white/10 shadow-inner">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Maximize2 size={14} className="text-emerald-500" /> 方位配置
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase mb-2 text-slate-500">
                  <span>廊道長度</span>
                  <span className="text-emerald-400 font-mono">{corridorL}</span>
                </div>
                <input type="range" min="10" max="100" value={corridorL} onChange={(e) => { setCorridorL(parseInt(e.target.value)); setSyncStatus('idle'); }} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
              </div>
            </div>
          </section>
          <section className="space-y-3.5 flex-1">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">六大修行區</h3>
            <div className="p-4 rounded-3xl border border-white/5 bg-slate-900/50 hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-between group border-l-4 border-l-emerald-400" onClick={() => { setSelectedZone({ id: 'center', name: '本心草原' }); setSelectedSubZoneIdx(0); setView('editor'); }}>
              <div className="flex items-center gap-2">
                <Heart size={14} className="text-emerald-400" />
                <span className="text-sm font-black text-slate-100">本心草原 (中心)</span>
              </div>
              <Edit3 size={14} className="text-slate-600 group-hover:text-emerald-400" />
            </div>
            {ZONES.map(z => (
              <div key={z.id} className="p-4 rounded-3xl border border-white/5 bg-slate-900/50 hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-between group border-l-4 border-l-transparent hover:border-l-current" style={{ color: z.color }} onClick={() => { setSelectedZone(z); setSelectedSubZoneIdx(0); setView('editor'); }}>
                <div className="flex items-center gap-2">
                  {z.icon}
                  <div className="flex flex-col">
                    <span className={`text-sm font-black ${z.textColor}`}>{z.name}</span>
                    <span className="text-[10px] opacity-60 italic">對應：{z.char}</span>
                  </div>
                </div>
                <Edit3 size={14} className="text-slate-600 group-hover:text-emerald-400" />
              </div>
            ))}
          </section>
          <button onClick={saveMapToCloud} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black text-sm transition-all shadow-2xl uppercase tracking-widest mt-auto">儲存地圖</button>
        </div>
      ) : (
        <div className="space-y-8 flex-1 flex flex-col">
          {selectedZone?.id !== 'center' && (
            <section className="mb-2 animate-in fade-in slide-in-from-top-4 duration-500">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                <LayoutGrid size={14} className="text-emerald-500" /> 子區域選擇
              </h3>
              <div className="grid grid-cols-4 gap-2 px-1">
                {[0, 1, 2, 3, 4, 5, 6].map(i => (
                  <button
                    key={i}
                    onClick={() => setSelectedSubZoneIdx(i)}
                    className={`h-10 rounded-xl text-xs font-bold transition-all border ${selectedSubZoneIdx === i
                      ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20 scale-105'
                      : 'bg-slate-900 border-white/5 text-slate-400 hover:border-white/20'
                      }`}
                  >
                    {i === 0 ? '中心' : i}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className={selectedZone?.id === 'center' ? "" : "border-t border-white/5 pt-6"}>
            <div className="flex items-center justify-between mb-5 px-1">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Layers size={14} className="text-emerald-500" /> {selectedZone?.name} 筆刷
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={handleRandomize} title="區域化隨機填滿" className="p-2 bg-white/5 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all border border-white/10 group"><Dices size={16} className="group-hover:rotate-12" /></button>
                <button onClick={handleFillAll} title="用當前筆刷填滿" className="p-2 bg-white/5 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-all border border-white/10 group"><PaintBucket size={16} className="group-hover:scale-110" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {Object.values(TERRAIN_TYPES)
                .filter(t => {
                  if (selectedZone?.id === 'center') return ['grass', 'roots', 'spring', 'roots_yggdrasil', 'portal'].includes(t.id);
                  if (selectedZone?.id === 'pride') return ['snow_path', 'ice_wall', 'thin_air', 'slippery_slope', 'cliffs_pride', 'portal_return_pride'].includes(t.id);
                  if (selectedZone?.id === 'doubt') return ['dark_trail', 'ancient_tree', 'fog', 'thorns', 'wall_thorns', 'portal_return_doubt'].includes(t.id);
                  if (selectedZone?.id === 'anger') return ['cracked_earth', 'obsidian', 'lava', 'geyser', 'abyssal_magma', 'portal_return_anger'].includes(t.id);
                  if (selectedZone?.id === 'greed') return ['wetland', 'rotten_vines', 'deep_bog', 'mimic', 'corrupted_vines', 'portal_return_greed'].includes(t.id);
                  if (selectedZone?.id === 'delusion') return ['sand_dune', 'sandstorm_wall', 'quicksand', 'mirage', 'chaos_storm_barr', 'portal_return_delusion'].includes(t.id);
                  if (selectedZone?.id === 'chaos') return ['ash_path', 'glitch_wall', 'entropy_field', 'random_anomaly', 'void', 'portal_return_chaos'].includes(t.id);
                  return true;
                })
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setBrush(t.id)}
                    className={`flex flex-col items-center p-3 rounded-3xl border transition-all overflow-hidden ${brush === t.id ? 'bg-emerald-500/10 border-emerald-500/50 scale-[0.98]' : 'bg-slate-900 border-white/5 opacity-50 hover:opacity-100 hover:bg-slate-800'}`}
                  >
                    <div className="w-12 h-12 rounded-2xl mb-2 overflow-hidden bg-slate-800 flex items-center justify-center relative">
                      {t.url ? <img src={t.url} alt={t.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-700" />}
                      {brush === t.id && <div className="absolute inset-0 bg-emerald-500/10 ring-2 ring-emerald-500/50 rounded-2xl" />}
                    </div>
                    <span className="text-[10px] font-black uppercase mb-1 text-center leading-tight h-5 overflow-hidden">{t.name}</span>
                  </button>
                ))}
            </div>
          </section>
          <section className="p-4 bg-emerald-500/5 rounded-3xl border border-emerald-500/10 mt-auto">
            <div className="flex items-center gap-2 mb-2 text-emerald-400">
              {selectedZone?.id === 'chaos' ? <AlertTriangle size={12} /> : <Navigation size={12} />}
              <h4 className="text-[10px] font-black uppercase">戰棋規則</h4>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed italic">{TERRAIN_TYPES[brush]?.effect}</p>
          </section>
          <button onClick={saveMapToCloud} className="w-full py-5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95"><Save size={18} /> 儲存編輯</button>
        </div>
      )}
    </aside>
  );
};
