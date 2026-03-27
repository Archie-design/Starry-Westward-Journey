"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

import { ZoneInfo, HexData } from '@/types';
import { DEFAULT_CONFIG, ZONES, TERRAIN_TYPES, zoneWeights } from '@/lib/constants';
import { saveWorldMap } from '@/app/actions/player';
import { axialToPixel, getHexRegion } from '@/lib/utils/hex';
import HexNode from '@/components/MapEditor/HexNode';
import { Navbar } from '@/components/MapEditor/Navbar';
import { Sidebar } from '@/components/MapEditor/Sidebar';

// --- Supabase 初始化 ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const App = () => {
  const [view, setView] = useState<'world' | 'editor'>('world');
  const [selectedZone, setSelectedZone] = useState<ZoneInfo | { id: string, name: string } | null>(null);
  const [selectedSubZoneIdx, setSelectedSubZoneIdx] = useState<number>(0);
  const [brush, setBrush] = useState<string>('grass');
  const [mapData, setMapData] = useState<Record<string, string>>({});
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  const [corridorL, setCorridorL] = useState<number>(DEFAULT_CONFIG.CORRIDOR_L);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data, error } = await supabase.from('world_maps').select('data').eq('id', 'main_world_map').single();
        if (data && data.data) {
          const fetchedData = data.data as { terrain?: Record<string, string>, config?: { corridorL: number, corridorW: number } };
          setMapData(fetchedData.terrain || {});
          if (fetchedData.config) {
            setCorridorL(fetchedData.config.corridorL || DEFAULT_CONFIG.CORRIDOR_L);
          }
          setSyncStatus('synced');
        }
      } catch (err) { setSyncStatus('error'); }
    };
    fetchInitialData();
  }, []);

  const saveMapToCloud = async () => {
    setSyncStatus('saving');
    const { error } = await saveWorldMap(mapData, { corridorL, corridorW: DEFAULT_CONFIG.CORRIDOR_W });
    if (error) { setSyncStatus('error'); } else { setSyncStatus('synced'); }
  };

  const handleHoverHex = useCallback((key: string | null) => {
    setHoveredHex(key);
  }, []);

  const handleHexClick = useCallback((q: number, r: number) => {
    if (view !== 'editor' || !selectedZone) return;
    const key = `${selectedZone.id}_${selectedSubZoneIdx}_${q},${r}`;
    setMapData(prev => ({ ...prev, [key]: brush }));
    setSyncStatus('idle');
  }, [view, selectedZone, selectedSubZoneIdx, brush]);

  const handleHexNodeClick = useCallback((hex: HexData) => {
    if (view === 'world' && hex.type === 'subzone') {
      const zone = ZONES.find(z => z.id === hex.zoneId);
      if (zone) {
        setSelectedZone(zone);
        setSelectedSubZoneIdx(hex.subIdx || 0);
        setView('editor');
      }
    } else if (view === 'world' && hex.type === 'center') {
      setSelectedZone({ id: 'center', name: '本心草原' } as ZoneInfo);
      setSelectedSubZoneIdx(0);
      setView('editor');
    } else if (view === 'editor') {
      handleHexClick(hex.q, hex.r);
    }
  }, [view, handleHexClick]);

  const handleFillAll = useCallback(() => {
    if (!selectedZone) return;
    const radius = DEFAULT_CONFIG.SUBZONE_SIDE - 1;
    const allHexes = getHexRegion(radius);
    const fillData: Record<string, string> = {};
    allHexes.forEach(h => {
      const key = `${selectedZone.id}_${selectedSubZoneIdx}_${h.q},${h.r}`;
      fillData[key] = brush;
    });
    setMapData(prev => ({ ...prev, ...fillData }));
    setSyncStatus('idle');
  }, [selectedZone, selectedSubZoneIdx, brush]);

  const handleRandomize = useCallback(() => {
    if (!selectedZone) return;
    const radius = DEFAULT_CONFIG.SUBZONE_SIDE - 1;
    const allHexes = getHexRegion(radius);
    const randomData: Record<string, string> = {};
    const weights = zoneWeights[selectedZone.id] || ['grass'];

    allHexes.forEach(h => {
      const key = `${selectedZone.id}_${selectedSubZoneIdx}_${h.q},${h.r}`;
      const randomTerrainId = weights[Math.floor(Math.random() * weights.length)];
      randomData[key] = randomTerrainId;
    });

    setMapData(prev => ({ ...prev, ...randomData }));
    setSyncStatus('idle');
  }, [selectedZone, selectedSubZoneIdx]);

  const worldGrid = useMemo(() => {
    const hexes: HexData[] = [];
    const hexMap = new Map<string, boolean>();
    const { CENTER_SIDE, SUBZONE_SIDE, HEX_SIZE_WORLD, CORRIDOR_W } = DEFAULT_CONFIG;
    const R_hub = CENTER_SIDE - 1;
    const S_s = SUBZONE_SIDE;

    getHexRegion(R_hub).forEach(p => {
      const pos = axialToPixel(p.q, p.r, HEX_SIZE_WORLD);
      const key = `center_0_${p.q},${p.r}`;
      const terrainId = mapData[key] || 'grass';
      hexes.push({
        ...p, ...pos, type: 'center', terrainId,
        color: TERRAIN_TYPES[terrainId]?.color || '#1a472a',
        key
      });
      hexMap.set(`${p.q},${p.r}`, true);
    });

    const sideData = [
      { start: { q: 0, r: -R_hub }, step: { q: 1, r: 0 }, out: { q: 1, r: -1 } },
      { start: { q: R_hub, r: -R_hub }, step: { q: 0, r: 1 }, out: { q: 1, r: 0 } },
      { start: { q: R_hub, r: 0 }, step: { q: -1, r: 1 }, out: { q: 0, r: 1 } },
      { start: { q: 0, r: R_hub }, step: { q: -1, r: 0 }, out: { q: -1, r: 1 } },
      { start: { q: -R_hub, r: R_hub }, step: { q: 0, r: -1 }, out: { q: -1, r: 0 } },
      { start: { q: -R_hub, r: 0 }, step: { q: 1, r: -1 }, out: { q: 0, r: -1 } },
    ];

    ZONES.forEach((zone, zIdx) => {
      const side = sideData[zIdx];
      const centerIdx = Math.floor(CENTER_SIDE / 2);
      const halfW = Math.floor(CORRIDOR_W / 2);
      for (let i = -halfW; i <= halfW; i++) {
        const idx = centerIdx + i;
        const startQ = side.start.q + side.step.q * idx;
        const startR = side.start.r + side.step.r * idx;
        for (let l = 1; l <= corridorL; l++) {
          const q = startQ + side.out.q * l;
          const r = startR + side.out.r * l;
          const key = `${q},${r}`;
          if (!hexMap.has(key)) {
            const pos = axialToPixel(q, r, HEX_SIZE_WORLD);
            hexes.push({ q, r, ...pos, type: 'corridor', color: '#1e293b', zoneId: zone.id, key: `corridor_${zone.id}_${key}` });
            hexMap.set(key, true);
          }
        }
      }
      const hubExitQ = side.start.q + side.step.q * centerIdx + side.out.q * corridorL;
      const hubExitR = side.start.r + side.step.r * centerIdx + side.out.r * corridorL;
      const zCQ = hubExitQ + side.out.q * S_s;
      const zCR = hubExitR + side.out.r * S_s;
      const subCenters = [
        { q: 0, r: 0 }, { q: 2 * S_s - 1, r: -(S_s - 1) }, { q: S_s, r: S_s - 1 },
        { q: -(S_s - 1), r: 2 * S_s - 1 }, { q: -(2 * S_s - 1), r: S_s - 1 },
        { q: -S_s, r: -(S_s - 1) }, { q: S_s - 1, r: -(2 * S_s - 1) }
      ];
      subCenters.forEach((sc, sIdx) => {
        const cq = zCQ + sc.q;
        const cr = zCR + sc.r;
        getHexRegion(S_s - 1).forEach(p => {
          const q = cq + p.q;
          const r = cr + p.r;
          const key = `${q},${r}`;
          if (!hexMap.has(key)) {
            const dataKey = `${zone.id}_${sIdx}_${p.q},${p.r}`;
            const terrainId = mapData[dataKey];
            const pos = axialToPixel(q, r, HEX_SIZE_WORLD);
            hexes.push({
              q, r, ...pos, type: 'subzone',
              color: terrainId ? (TERRAIN_TYPES[terrainId]?.color || zone.color) : zone.color,
              terrainId: terrainId, zoneId: zone.id, subIdx: sIdx, key: dataKey
            });
            hexMap.set(key, true);
          }
        });
      });
    });

    return hexes.sort((a, b) => a.y - b.y);
  }, [mapData, corridorL]);

  return (
    <div className="flex flex-col h-screen bg-[#040407] text-slate-300 font-sans overflow-hidden">
      <Navbar view={view} setView={setView} syncStatus={syncStatus} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          view={view}
          setView={setView}
          selectedZone={selectedZone}
          setSelectedZone={setSelectedZone}
          selectedSubZoneIdx={selectedSubZoneIdx}
          setSelectedSubZoneIdx={setSelectedSubZoneIdx}
          corridorL={corridorL}
          setCorridorL={setCorridorL}
          setSyncStatus={setSyncStatus}
          brush={brush}
          setBrush={setBrush}
          handleRandomize={handleRandomize}
          handleFillAll={handleFillAll}
          saveMapToCloud={saveMapToCloud}
        />

        <main className="flex-1 relative bg-[#010103] flex items-center justify-center overflow-hidden cursor-crosshair">
          <svg viewBox={view === 'world' ? "-1200 -1200 2400 2400" : "-600 -600 1200 1200"} className="w-full h-full max-w-[98vh] transition-all duration-1000 ease-in-out">
            <g>
              {(view === 'world' ? worldGrid :
                getHexRegion(DEFAULT_CONFIG.SUBZONE_SIDE - 1).map(h => {
                  const pos = axialToPixel(h.q, h.r, DEFAULT_CONFIG.HEX_SIZE_EDITOR);
                  const key = `${selectedZone?.id}_${selectedSubZoneIdx}_${h.q},${h.r}`;
                  const terrainId = mapData[key];
                  return {
                    ...h, ...pos, key, terrainId,
                    type: 'subzone',
                    color: terrainId ? (TERRAIN_TYPES[terrainId]?.color || (selectedZone as ZoneInfo)?.color) : (selectedZone?.id === 'center' ? '#1a472a' : (selectedZone as ZoneInfo)?.color)
                  } as HexData;
                }).sort((a, b) => a.y - b.y)
              ).map(hex => (
                <HexNode
                  key={hex.key}
                  hex={hex}
                  size={view === 'world' ? DEFAULT_CONFIG.HEX_SIZE_WORLD : DEFAULT_CONFIG.HEX_SIZE_EDITOR}
                  isHovered={hoveredHex === hex.key}
                  onClick={handleHexNodeClick}
                  onHover={handleHoverHex}
                />
              ))}
            </g>
          </svg>
          <div className="absolute bottom-6 right-6 bg-slate-900/80 px-6 py-3 rounded-2xl border border-emerald-500/20 backdrop-blur-xl flex items-center gap-3 shadow-2xl pointer-events-none">
            <Heart size={16} className="text-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest italic">
              {selectedZone?.id === 'center' ? '區域模式：唯一聖域 - 本心草原' : `編輯區塊：${selectedZone?.name || '無'} - 第 ${selectedSubZoneIdx} 號小區`}
            </span>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;