import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, MapIcon, Dice5, Loader2, Minus, Plus, Footprints, Package, Store, LocateFixed, Globe } from 'lucide-react';
import { CharacterStats, HexData } from '@/types';
import { DEFAULT_CONFIG, TERRAIN_TYPES, ROLE_CURE_MAP, ZONES } from '@/lib/constants';
import { getHexRegion, axialToPixelPos, getHexDist, pixelToAxial, getCombatMultiplier, getHexDirection, hexLineDraw } from '@/lib/utils/hex';
import { getMonsterImageSrc } from '@/lib/utils/monster';
import HexNode from '@/components/MapEditor/HexNode';
import { GameInventoryModal } from '@/components/MapEditor/GameInventoryModal';
import { WorldOverview } from '@/components/Map/WorldOverview';
import { NPCShopModal } from '@/components/MapEditor/NPCShopModal';
import { CombatModal } from '@/components/MapEditor/CombatModal';
import { buyGameItem, useGameItem, pushMonsterByFan } from '@/app/actions/items';
import { resolveCombat } from '@/app/actions/combat';
import { applyTrapDamage } from '@/app/actions/map';
import { donateDice } from '@/app/actions/team';
import { blessChestWithGoldenDice } from '@/app/actions/dice';
import { recordSomersaultUsed, useNineToothRake, dragonSoarDonate, usePrajnaMantra, pullTangSanzang } from '@/app/actions/skills';

// --- Types ---
interface WorldMapProps {
    userData: CharacterStats;
    mapData: Record<string, string>;
    corridorL: number;
    corridorW: number;
    stepsRemaining: number;
    isRolling: boolean;
    onRollDice: (amount: number) => void;
    onMoveCharacter: (q: number, r: number, dist: number, zoneId?: string, newFacing?: number) => void;
    onBack: () => void;
    moveMultiplier?: number;
    onUpdateMultiplier?: (m: number) => void;
    dbEntities?: any[];
    worldState?: string;
    onEntityTrigger?: (entity: any) => void;
    initialQ: number;
    initialR: number;
    roleTrait: any;
    todayCompletedQuestIds: string[];
    onShowMessage: (msg: string, type: 'success' | 'error' | 'info') => void;
    onUpdateUserData: (data: Partial<CharacterStats>) => void;
    onUpdateSteps?: (steps: number) => void;
    isIrritable?: boolean;        // 緊箍咒：孫悟空當日未完成 q2
    onExchangeGoldenDice?: () => void;
    onSpringHeal?: () => void;
    onPortalUse?: () => void;
    onPortalReturn?: () => void;
    onIsolationFreeze?: () => void;
    onLavaDoT?: () => void;
    onGeyserKnockback?: (newQ: number, newR: number) => void;
    onDeepBog?: () => void;
    onMimicStep?: () => void;
    onQuicksandDrift?: (newQ: number, newR: number) => void;
    onPlayerDeath?: () => void;     // E6 死亡懲罰：HP歸零時通知 page.tsx 處理
    teamMembers?: CharacterStats[];  // 白龍馬龍騰：隊友選擇
}

// --- Memoized Static Layer ---
// 兩個 pass 解決等角投影遮蔽問題：先畫所有地板，再畫所有地形裝飾
const StaticMapLayer = React.memo(({ grid, className = "", style = {} }: { grid: HexData[], className?: string, style?: React.CSSProperties }) => {
    return (
        <g className={className} style={style}>
            {grid.map(hex => (
                <HexNode
                    key={`base_${hex.key}`}
                    hex={hex}
                    isHovered={false}
                    onHover={() => { }}
                    onClick={() => { }}
                    size={DEFAULT_CONFIG.HEX_SIZE_WORLD}
                    renderPass="base"
                />
            ))}
            {grid.map(hex => (
                <HexNode
                    key={`deco_${hex.key}`}
                    hex={hex}
                    isHovered={false}
                    onHover={() => { }}
                    onClick={() => { }}
                    size={DEFAULT_CONFIG.HEX_SIZE_WORLD}
                    renderPass="decoration"
                />
            ))}
        </g>
    );
}, (prev, next) => {
    return prev.grid === next.grid && prev.className === next.className;
});
StaticMapLayer.displayName = 'StaticMapLayer';

// --- Memoized Dynamic Layer ---
const DynamicOverlayLayer = React.memo(({
    grid, userData, stepsRemaining, hoveredHexKey
}: {
    grid: HexData[],
    userData: CharacterStats,
    stepsRemaining: number,
    hoveredHexKey: string | null
}) => {
    if (stepsRemaining <= 0 && !hoveredHexKey) return null;

    return (
        <g style={{ pointerEvents: 'none' }}>
            {grid.map(hex => {
                const isHovered = hoveredHexKey === hex.key;
                const isMovable = stepsRemaining > 0 && getHexDist(userData.CurrentQ, userData.CurrentR, hex.q, hex.r) <= stepsRemaining;

                if (!isHovered && !isMovable) return null;

                return (
                    <g key={`overlay_${hex.key}`}>
                        <polygon
                            points={getHexRegion(0)[0] ? getHexPointsStr(hex.x, hex.y, DEFAULT_CONFIG.HEX_SIZE_WORLD * 1.01) : ""}
                            fill={isMovable ? "rgba(16, 185, 129, 0.4)" : "transparent"}
                            stroke={isHovered ? "rgba(255,255,255,0.8)" : "transparent"}
                            strokeWidth="2"
                        />
                    </g>
                );
            })}
        </g>
    );
});
DynamicOverlayLayer.displayName = 'DynamicOverlayLayer';

// Helper for polygon points - extracted locally to keep it pure
function getHexPointsStr(x: number, y: number, size: number) {
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle_deg = 60 * i - 30;
        const angle_rad = Math.PI / 180 * angle_deg;
        points.push(`${x + size * Math.cos(angle_rad)},${y + size * Math.sin(angle_rad)}`);
    }
    return points.join(' ');
}


export const WorldMap: React.FC<WorldMapProps> = ({
    userData, mapData, corridorL, corridorW, stepsRemaining, isRolling,
    onRollDice, onMoveCharacter, onBack, initialQ, initialR,
    roleTrait, todayCompletedQuestIds, onShowMessage,
    dbEntities = [], worldState, onEntityTrigger, moveMultiplier = 1, onUpdateMultiplier, onUpdateUserData, onUpdateSteps,
    isIrritable = false,
    onExchangeGoldenDice,
    onSpringHeal, onPortalUse, onPortalReturn, onIsolationFreeze, onLavaDoT, onGeyserKnockback,
    onDeepBog, onMimicStep, onQuicksandDrift, onPlayerDeath,
    teamMembers = [],
}) => {
    // Navigation & Scale — initialize camera centered on player to avoid first-render flash
    const [camX, setCamX] = useState(() => -axialToPixelPos(initialQ, initialR, DEFAULT_CONFIG.HEX_SIZE_WORLD).x);
    const [camY, setCamY] = useState(() => -axialToPixelPos(initialQ, initialR, DEFAULT_CONFIG.HEX_SIZE_WORLD).y);
    const [zoom, setZoom] = useState(1);
    const [isOverviewOpen, setIsOverviewOpen] = useState(false);
    const [rollAmount, setRollAmount] = useState(1);
    const [hoveredHexKey, setHoveredHexKey] = useState<string | null>(null);
    const [interceptTriggeredPos, setInterceptTriggeredPos] = useState<string | null>(null);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [isCombatModalOpen, setIsCombatModalOpen] = useState(false);
    const [combatTarget, setCombatTarget] = useState<any>(null);
    const [combatFlankingMultiplier, setCombatFlankingMultiplier] = useState(1.0);
    const [isProcessingItem, setIsProcessingItem] = useState(false);
    const [hoveredHexPos, setHoveredHexPos] = useState<{ q: number, r: number, x: number, y: number } | null>(null);
    const [donationTarget, setDonationTarget] = useState<any>(null);
    const [donateAmount, setDonateAmount] = useState(1);
    const [isDonating, setIsDonating] = useState(false);
    const [plannedPath, setPlannedPath] = useState<{q: number, r: number}[]>([]);
    const [isPlanningMode, setIsPlanningMode] = useState(false);
    const [isStatsExpanded, setIsStatsExpanded] = useState(false);
    const [ignoreTerrainThisTurn, setIgnoreTerrainThisTurn] = useState(false); // i5 步雲履
    const [combatStatBuff, setCombatStatBuff] = useState(false);               // i9 九轉金丹
    const [hasDeathShield, setHasDeathShield] = useState(false);               // i3 錦鑭袈裟
    const [mimicImmune, setMimicImmune] = useState(false);                     // i2 火眼金睛
    const [sealMonsterPassive, setSealMonsterPassive] = useState(false);        // i4 如意金剛琢
    const [d1CombatBuff, setD1CombatBuff] = useState<number>(1.0);             // d1 五毒精魄
    const [d2LevelDebuff, setD2LevelDebuff] = useState<number>(0);             // d2 業障石
    const [d6ForceMimic, setD6ForceMimic] = useState(false);                   // d6 貪狼之爪
    const [facing, setFacing] = useState(0);                                    // 當前面向（0–5）
    const [dingXinZhuActive, setDingXinZhuActive] = useState(false);           // 沙悟淨 定心杵：位移免疫
    const [noCritIncoming, setNoCritIncoming] = useState(false);               // 沙悟淨 定心杵：禁爆擊
    const [dragonSoarPending, setDragonSoarPending] = useState(false);         // 白龍馬 龍騰：移動後顯示
    const [isSkillPanelOpen, setIsSkillPanelOpen] = useState(false);           // 技能面板開關
    const [dragonSoarTarget, setDragonSoarTarget] = useState<CharacterStats | null>(null); // 龍騰隊友選擇
    const [isFanDirectionMode, setIsFanDirectionMode] = useState(false);       // i6 芭蕉扇：等待方向選擇
    const [pendingChestEntity, setPendingChestEntity] = useState<any>(null);   // I4 黃金骰子加持：等待確認

    const [dismissedCombatKeys, _setDismissedCombatKeys] = useState<Set<string>>(() => {
        try {
            const data = sessionStorage.getItem('starry_dismissed');
            if (data) return new Set<string>(JSON.parse(data));
        } catch (e) { }
        return new Set<string>();
    });
    const setDismissedCombatKeys = useCallback((setter: (prev: Set<string>) => Set<string>) => {
        _setDismissedCombatKeys(prev => {
            const next = setter(prev);
            sessionStorage.setItem('starry_dismissed', JSON.stringify(Array.from(next)));
            return next;
        });
    }, []);

    // Dragging state
    const isDragging = useRef(false);
    const hasDragged = useRef(false); // true only after movement exceeds tap threshold
    const dragStart = useRef({ x: 0, y: 0 });
    const tapOrigin = useRef({ x: 0, y: 0 }); // initial touch position, never updated
    const lastTouchTime = useRef(0); // suppress synthetic mouse events after touch
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const hudRef = useRef<HTMLDivElement>(null); // dice HUD ref — events from inside are ignored by map
    const statsHudRef = useRef<HTMLDivElement>(null); // stats HUD ref — tap-to-expand on mobile
    const recenterBtnRef = useRef<HTMLButtonElement>(null); // recenter button — prevent tap from triggering hex move
    // Pinch-to-zoom state
    const isPinching = useRef(false);
    const pinchStartDist = useRef(0);
    const pinchStartZoom = useRef(1);

    // Constants
    const { HEX_SIZE_WORLD, CENTER_SIDE, SUBZONE_SIDE } = DEFAULT_CONFIG;

    // O2: 孫悟空持金箍棒可穿越黑曜石岩（不可停留在黑曜石上）
    const isHexImpassable = useCallback((terrainId: string | undefined, isDestination = false): boolean => {
        if (!terrainId) return false;
        if (terrainId === 'obsidian' && userData.Role === '孫悟空') {
            // 孫悟空可穿越黑曜石，但不能以黑曜石為終點
            return isDestination;
        }
        return TERRAIN_TYPES[terrainId]?.impassable ?? false;
    }, [userData.Role]);
    // Make the virtual canvas huge so panning works via CSS transform
    const VIRTUAL_MAP_SIZE = 6000;

    const getEntityKey = useCallback((e: any) => {
        if (!e) return '';
        if (e.id) return `db_${e.id}`;
        return e.key ?? '';
    }, []);

    // Recenter camera when player moves (initialQ/R updates from parent)
    useEffect(() => {
        const initPos = axialToPixelPos(initialQ, initialR, HEX_SIZE_WORLD);
        setCamX(-initPos.x);
        setCamY(-initPos.y);
    }, [initialQ, initialR, HEX_SIZE_WORLD]);

    // Track container size reactively for accurate HUD positioning
    // Full Grid Calculation (Memoized, only runs once after mapData loads)
    const fullGrid = useMemo(() => {
        const hexes: HexData[] = [];
        const hexMap = new Map<string, boolean>();
        const R_hub = CENTER_SIDE - 1;
        const S_s = SUBZONE_SIDE;

        // Culling settings 
        const RENDER_RADIUS = 20;
        const CRISP_RADIUS = 10;

        const getRenderRing = (q: number, r: number) => {
            const dist = getHexDist(initialQ, initialR, q, r);
            if (dist <= CRISP_RADIUS) return 'crisp';
            if (dist <= RENDER_RADIUS) return 'performance';
            return 'culled';
        };

        getHexRegion(R_hub).forEach(p => {
            const ring = getRenderRing(p.q, p.r);
            if (ring === 'culled') return;
            const pos = axialToPixelPos(p.q, p.r, HEX_SIZE_WORLD);
            const key = `center_0_${p.q},${p.r}`;
            const terrainId = mapData[key] || 'grass';
            hexes.push({ ...p, ...pos, type: 'center', terrainId, color: TERRAIN_TYPES[terrainId]?.color || '#1a472a', key, ring });
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
            const halfW = Math.floor(corridorW / 2);
            for (let i = -halfW; i <= halfW; i++) {
                const idx = centerIdx + i;
                const startQ = side.start.q + side.step.q * idx;
                const startR = side.start.r + side.step.r * idx;
                for (let l = 1; l <= corridorL; l++) {
                    const q = startQ + side.out.q * l;
                    const r = startR + side.out.r * l;
                    const ring = getRenderRing(q, r);
                    if (ring === 'culled') continue;

                    const key = `${q},${r}`;
                    if (!hexMap.has(key)) {
                        const pos = axialToPixelPos(q, r, HEX_SIZE_WORLD);
                        hexes.push({ q, r, ...pos, type: 'corridor', color: '#1e293b', zoneId: zone.id, key: `corridor_${zone.id}_${key}`, ring });
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
                    const ring = getRenderRing(q, r);
                    if (ring === 'culled') return;

                    const key = `${q},${r}`;
                    if (!hexMap.has(key)) {
                        const dataKey = `${zone.id}_${sIdx}_${p.q},${p.r}`;
                        const terrainId = mapData[dataKey];
                        const pos = axialToPixelPos(q, r, HEX_SIZE_WORLD);
                        hexes.push({
                            q, r, ...pos, type: 'subzone',
                            color: terrainId ? (TERRAIN_TYPES[terrainId]?.color || zone.color) : zone.color,
                            terrainId, zoneId: zone.id, subIdx: sIdx, key: dataKey, ring
                        });
                        hexMap.set(key, true);
                    }
                });
            });
        });

        return hexes;
    }, [mapData, corridorL, corridorW, HEX_SIZE_WORLD, initialQ, initialR]);

    const perfLayerGrid = useMemo(() => fullGrid.filter(h => h.ring === 'performance'), [fullGrid]);
    const crispLayerGrid = useMemo(() => fullGrid.filter(h => h.ring === 'crisp'), [fullGrid]);

    // Check Entity Collision after movement
    useEffect(() => {
        if (onEntityTrigger && !isCombatModalOpen) {
            const allEntities = dbEntities.filter(e => e.is_active !== false && e.type !== 'personal');

            // 1. Proactive Interception: Check for monsters in adjacent hexes (dist === 1)
            const currentPosKey = `${userData.CurrentQ},${userData.CurrentR}`;
            if (interceptTriggeredPos !== currentPosKey) {
                const neighborMonster = allEntities.find(e =>
                    e.type === 'monster' &&
                    getHexDist(userData.CurrentQ, userData.CurrentR, e.q, e.r) === 1 &&
                    !dismissedCombatKeys.has(getEntityKey(e))
                );

                if (neighborMonster) {
                    const targetFacing = neighborMonster.data?.facing || 0;
                    const flanking = getCombatMultiplier({ q: userData.CurrentQ, r: userData.CurrentR }, { q: neighborMonster.q, r: neighborMonster.r }, targetFacing);
                    setCombatFlankingMultiplier(flanking);
                    setCombatTarget(neighborMonster);
                    setInterceptTriggeredPos(currentPosKey);
                    setIsCombatModalOpen(true);
                    return;
                }
            }

            // 2. Exact Match: Only for non-monster entities (like chests/encounters) when steps are finished
            if (stepsRemaining === 0) {
                const exactMatch = allEntities.find(e =>
                    e.q === userData.CurrentQ && e.r === userData.CurrentR &&
                    e.type !== 'monster' && e.type !== 'trap'  // trap 對玩家無效
                );
                if (exactMatch) {
                    if (exactMatch.type === 'portal') {
                        const todayQCount = (todayCompletedQuestIds ?? []).filter(id => /^q/.test(id)).length;
                        if (todayQCount < 3) {
                            onShowMessage('受五毒業力牽引，歸心陣無法啟動。請先完成 3 項定課再啟動。', 'error');
                            return;
                        }
                    }
                    if (exactMatch.type === 'chest' && mimicImmune) {
                        onEntityTrigger({ ...exactMatch, _mimicImmune: true });
                        setMimicImmune(false);
                    } else if (exactMatch.type === 'chest' && d6ForceMimic) {
                        onEntityTrigger({ ...exactMatch, _forceMimic: true });
                        setD6ForceMimic(false);
                    } else if (exactMatch.type === 'chest' && (userData.GoldenDice ?? 0) > 0) {
                        // I4 黃金骰子加持：詢問玩家是否消耗 1 顆黃金骰換取必得 3 骰 + 跳過 Mimic
                        setPendingChestEntity(exactMatch);
                    } else {
                        onEntityTrigger(exactMatch);
                    }
                }

                // d5 業火之種：檢查當格是否有陷阱 + 怪物共存（玩家踩過陷阱格並觸發攻擊）
                const trapOnHex = allEntities.find(e =>
                    e.q === userData.CurrentQ && e.r === userData.CurrentR && e.type === 'trap'
                );
                const monsterOnHex = allEntities.find(e =>
                    e.q === userData.CurrentQ && e.r === userData.CurrentR && e.type === 'monster'
                );
                if (trapOnHex && monsterOnHex) {
                    applyTrapDamage(String(trapOnHex.id), String(monsterOnHex.id))
                        .then(res => {
                            if (res.success) {
                                onShowMessage(res.message ?? '', 'success');
                                if (res.killed) {
                                    onUpdateUserData({ removeEntityId: monsterOnHex.id } as any);
                                }
                            }
                        })
                        .catch(() => { /* non-critical */ });
                }
            }
        }
    }, [userData.CurrentQ, userData.CurrentR, stepsRemaining, isCombatModalOpen, dbEntities, onEntityTrigger, dismissedCombatKeys]);

    // Reset planning state when AP runs out
    useEffect(() => {
        if (stepsRemaining === 0) {
            setPlannedPath([]);
            setIsPlanningMode(false);
        }
    }, [stepsRemaining]);

    // Hex direction vectors (pointy-topped axial, indices 0-5)
    const HEX_DIRECTIONS = [
        { q: 1, r: -1 }, { q: 1, r: 0 }, { q: 0, r: 1 },
        { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }
    ];

    // Returns the closest hex direction index for an arbitrary (non-unit) delta
    const getClosestHexDir = useCallback((fromQ: number, fromR: number, toQ: number, toR: number): number => {
        const dq = toQ - fromQ;
        const dr = toR - fromR;
        let best = 0;
        let bestDot = -Infinity;
        for (let i = 0; i < 6; i++) {
            const d = HEX_DIRECTIONS[i];
            const dot = d.q * dq + d.r * dr;
            if (dot > bestDot) { bestDot = dot; best = i; }
        }
        return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Spring terrain healing when turn ends on a spring hex.
    // Only fires when transitioning from >0 steps to 0 (actual turn end), not on initial mount.
    const prevStepsRef = useRef(stepsRemaining);
    useEffect(() => {
        const wasMoving = prevStepsRef.current > 0;
        prevStepsRef.current = stepsRemaining;
        if (stepsRemaining === 0 && wasMoving) {
            const currentHex = fullGrid.find(h => h.q === userData.CurrentQ && h.r === userData.CurrentR);
            if (currentHex?.terrainId === 'spring' && onSpringHeal) {
                onSpringHeal();
            }
            if (currentHex?.terrainId === 'portal' && onPortalUse) {
                onPortalUse();
            }
            if (currentHex?.terrainId?.startsWith('portal_return') && onPortalReturn) {
                onPortalReturn();
            }
            // 刺骨孤寒 (Isolation Freeze): end-of-turn deducts 1 energy dice
            // 謙卑 Buff (q5 completed) grants immunity
            if (currentHex?.terrainId === 'thin_air' && onIsolationFreeze) {
                if (todayCompletedQuestIds.includes('q5')) {
                    onShowMessage('謙卑護體！刺骨孤寒的寒意被你的謙遜化解。', 'success');
                } else {
                    onIsolationFreeze();
                }
            }
            // 迷霧 (Dense Fog): notify on arrival when fog is active
            if (currentHex?.terrainId === 'fog' && !todayCompletedQuestIds.includes('q3')) {
                const hasLantern = userData.GameInventory?.some(i => i.id === 'i2') ?? false;
                const range = hasLantern ? 3 : 2;
                onShowMessage(`濃霧籠罩！${range} 格外的心魔數值無法辨識${hasLantern ? '（火眼金睛擴展至 3 格）' : ''}。`, 'info');
            }
            // 熔岩流 (Lava Flow): 回合結束扣 5% MaxHP。清涼心 Buff (q1/q1_dawn/q2) 免疫
            if (currentHex?.terrainId === 'lava') {
                const hasCoolHeart = todayCompletedQuestIds.includes('q1') ||
                    todayCompletedQuestIds.includes('q1_dawn') ||
                    todayCompletedQuestIds.includes('q2');
                if (hasCoolHeart) {
                    onShowMessage('清涼心護體！熔岩的灼傷被你的定力化解。', 'success');
                } else {
                    onLavaDoT?.();
                }
            }
            // 間歇泉 (Geyser): 30% 機率彈射至隨機可行走鄰格，受 5% MaxHP 傷害
            if (currentHex?.terrainId === 'geyser' && Math.random() < 0.3) {
                const dirs = [{q:1,r:0},{q:-1,r:0},{q:0,r:1},{q:0,r:-1},{q:1,r:-1},{q:-1,r:1}];
                const walkable = dirs
                    .map(d => fullGrid.find(h => h.q === userData.CurrentQ + d.q && h.r === userData.CurrentR + d.r))
                    .filter(h => h && !TERRAIN_TYPES[h.terrainId ?? '']?.impassable);
                if (walkable.length > 0) {
                    const target = walkable[Math.floor(Math.random() * walkable.length)]!;
                    onGeyserKnockback?.(target.q, target.r);
                }
            }
            // 偽裝寶箱 (Mimic Chest): 每次落點觸發慧根檢定，無冷卻，無輕盈免疫
            if (currentHex?.terrainId === 'mimic') {
                onMimicStep?.();
            }
            // 迷走流沙 (Quicksand): 回合結束被強制位移至隨機可行走鄰格。定心 Buff (q4) 或 定心杵技能 免疫
            // 沙悟淨天賦「捲簾大將」：永久被動免疫流沙強制位移
            if (currentHex?.terrainId === 'quicksand' && !todayCompletedQuestIds.includes('q4') && userData.Role !== '沙悟淨') {
                if (dingXinZhuActive) {
                    setDingXinZhuActive(false);
                    setNoCritIncoming(false);
                    onShowMessage('定心杵護身！流沙位移被抵消。', 'info');
                } else {
                    const dirs = [{q:1,r:-1},{q:1,r:0},{q:0,r:1},{q:-1,r:1},{q:-1,r:0},{q:0,r:-1}];
                    const walkable = dirs
                        .map(d => fullGrid.find(h => h.q === userData.CurrentQ + d.q && h.r === userData.CurrentR + d.r))
                        .filter(h => h && !TERRAIN_TYPES[h.terrainId ?? '']?.impassable);
                    if (walkable.length > 0) {
                        const target = walkable[Math.floor(Math.random() * walkable.length)]!;
                        onQuicksandDrift?.(target.q, target.r);
                    }
                }
            }
            // i5 步雲履：回合結束時清除地形免疫 buff
            setIgnoreTerrainThisTurn(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepsRemaining, userData.CurrentQ, userData.CurrentR]);

    // 迷霧 (Dense Fog) state: active when player stands on fog terrain without 心燈 Buff (q3)
    // 孫悟空天賦「越戰越勇」：無視迷霧陷阱
    const isFogActive = useMemo(() => {
        const cur = fullGrid.find(h => h.q === userData.CurrentQ && h.r === userData.CurrentR);
        return cur?.terrainId === 'fog'
            && !todayCompletedQuestIds.includes('q3')
            && userData.Role !== '孫悟空';
    }, [fullGrid, userData.CurrentQ, userData.CurrentR, todayCompletedQuestIds, userData.Role]);

    // i2 火眼金睛（被動）: 持有時可見範圍從 2 格擴大至 3 格
    const fogVisRange = useMemo(() => {
        if (!isFogActive) return 2;
        return (userData.GameInventory?.some(i => i.id === 'i2') ?? false) ? 3 : 2;
    }, [isFogActive, userData.GameInventory]);

    const isFogEntityObscured = useCallback((eq: number, er: number) =>
        isFogActive && getHexDist(userData.CurrentQ, userData.CurrentR, eq, er) > fogVisRange,
    [isFogActive, fogVisRange, userData.CurrentQ, userData.CurrentR]);

    // --- Event Delegation ---
    const getCurrentPointerHex = useCallback((clientX: number, clientY: number) => {
        if (!mapContainerRef.current) return null;
        const rect = mapContainerRef.current.getBoundingClientRect();
        // Container center
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Calculate mouse position relative to center of screen
        const mouseX = clientX - rect.left - centerX;
        const mouseY = clientY - rect.top - centerY;

        // Remove the CSS transform (camX, camY) and scale (zoom) to get pure SVG coordinates
        // SVG origin is centered in the VIRTUAL_MAP_SIZE container
        const svgX = (mouseX / zoom) - camX;
        const svgY = (mouseY / zoom) - camY;

        // Convert to axial
        const { q, r } = pixelToAxial(svgX, svgY, HEX_SIZE_WORLD);
        return { q, r };
    }, [camX, camY, zoom, HEX_SIZE_WORLD]);

    const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        // Two-finger pinch-to-zoom
        if ('touches' in e && e.touches.length === 2) {
            const t = e.touches;
            const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
            if (!isPinching.current) {
                isPinching.current = true;
                pinchStartDist.current = dist;
                pinchStartZoom.current = zoom;
                isDragging.current = false;
            } else {
                const ratio = dist / pinchStartDist.current;
                setZoom(Math.min(Math.max(0.3, pinchStartZoom.current * ratio), 6));
            }
            return;
        }
        isPinching.current = false;

        if (isDragging.current) {
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            const totalDx = Math.abs(clientX - tapOrigin.current.x);
            const totalDy = Math.abs(clientY - tapOrigin.current.y);
            const panThreshold = 'touches' in e ? 14 : 5;
            // Don't pan camera until movement clearly exceeds tap threshold
            if (!hasDragged.current && totalDx < panThreshold && totalDy < panThreshold) return;
            hasDragged.current = true;
            const dx = clientX - dragStart.current.x;
            const dy = clientY - dragStart.current.y;
            setCamX(prev => prev + dx / zoom);
            setCamY(prev => prev + dy / zoom);
            dragStart.current = { x: clientX, y: clientY };
            if (hoveredHexKey) setHoveredHexKey(null);
            return;
        }

        // Hover logic (desktop only)
        if ('clientX' in e && !isDragging.current) {
            const hex = getCurrentPointerHex(e.clientX, e.clientY);
            if (hex) {
                // Find if this hex is in the grid computationally to prevent hovering void
                const target = fullGrid.find(h => h.q === hex.q && h.r === hex.r);
                setHoveredHexKey(target ? target.key : null);
                if (target) {
                    setHoveredHexPos({ q: hex.q, r: hex.r, x: e.clientX, y: e.clientY });
                } else {
                    setHoveredHexPos(null);
                }
            } else {
                setHoveredHexKey(null);
                setHoveredHexPos(null);
            }
        }
    }, [getCurrentPointerHex, zoom, hoveredHexKey, fullGrid]);

    const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const isTouch = 'touches' in e;
        // Ignore events originating from within the dice HUD panel
        const nativeTarget = ('touches' in e ? e.touches[0]?.target : (e as React.MouseEvent).target) as Node | null;
        if (nativeTarget && hudRef.current?.contains(nativeTarget)) return;
        if (nativeTarget && statsHudRef.current?.contains(nativeTarget)) return;
        if (nativeTarget && recenterBtnRef.current?.contains(nativeTarget)) return;
        // Ignore synthetic mouse events that fire after touch (within 500ms)
        if (!isTouch && Date.now() - lastTouchTime.current < 500) return;
        if (isTouch) lastTouchTime.current = Date.now();
        isDragging.current = true;
        hasDragged.current = false;
        const x = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
        const y = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
        dragStart.current = { x, y };
        tapOrigin.current = { x, y };
    }, []);

    const handlePointerUp = useCallback((_e: React.MouseEvent | React.TouchEvent) => {
        // Always reset drag/pinch state first — prevents stuck state when early returns skip the end of function
        const wasDragging = isDragging.current;
        isDragging.current = false;
        isPinching.current = false;

        // If it was a click without dragging much, trigger Click logic
        if (wasDragging) {
            if (!hasDragged.current) {
                // Was a tap/click — use initial touch position for accurate hex detection
                // (camX/camY unchanged since no camera movement occurred)
                const hex = getCurrentPointerHex(tapOrigin.current.x, tapOrigin.current.y);
                if (hex) {
                    // Check for targetable adjacent entities first
                    const allEntities = [...dbEntities];

                    // Check for adjacent teammate → open donation
                    const teammateEntity = allEntities.find(e => e.q === hex.q && e.r === hex.r && e.type === 'teammate');
                    if (teammateEntity) {
                        const dist = getHexDist(userData.CurrentQ, userData.CurrentR, hex.q, hex.r);
                        if (dist <= 2) {
                            setDonationTarget(teammateEntity);
                            setDonateAmount(1);
                            return;
                        }
                    }

                    const targetEntity = allEntities.find(e => e.q === hex.q && e.r === hex.r && e.type === 'monster');
                    if (targetEntity) {
                        const dist = getHexDist(userData.CurrentQ, userData.CurrentR, hex.q, hex.r);
                        if (dist === 1) {
                            // Adjacent monster! Calculate Flanking
                            const targetFacing = targetEntity.data?.facing || 0; // default front is 0
                            const flanking = getCombatMultiplier({ q: userData.CurrentQ, r: userData.CurrentR }, hex, targetFacing);
                            setCombatFlankingMultiplier(flanking);
                            setCombatTarget(targetEntity);
                            setIsCombatModalOpen(true);
                            return;
                        }
                    }

                    // PLANNING MODE: build path step by step
                    if (isPlanningMode && stepsRemaining > 0) {
                        const lastHex = plannedPath.length > 0
                            ? plannedPath[plannedPath.length - 1]
                            : { q: userData.CurrentQ, r: userData.CurrentR };
                        const stepDist = getHexDist(lastHex.q, lastHex.r, hex.q, hex.r);
                        // Undo last step by clicking the last planned hex
                        if (plannedPath.length > 0 && hex.q === lastHex.q && hex.r === lastHex.r) {
                            setPlannedPath(prev => prev.slice(0, -1));
                            return;
                        }
                        if (stepDist === 1) {
                            const hexData = fullGrid.find(h => h.q === hex.q && h.r === hex.r);
                            if (isHexImpassable(hexData?.terrainId, true)) {
                                onShowMessage('此地形無法通行！', 'error');
                                return;
                            }
                            const cursedMultiplier = (roleTrait?.name === '豬八戒' && roleTrait?.isCursed) ? 1.5 : 1;
                            const newCost = Math.ceil((plannedPath.length + 1) * cursedMultiplier);
                            if (newCost <= stepsRemaining) {
                                setPlannedPath(prev => [...prev, { q: hex.q, r: hex.r }]);
                            } else {
                                onShowMessage('步數不足，無法繼續規劃！', 'error');
                            }
                        } else {
                            onShowMessage('只能逐格點選相鄰格子', 'info');
                        }
                        return;
                    }

                    if (stepsRemaining > 0) {
                        let targetQ = hex.q;
                        let targetR = hex.r;

                        // 孫悟空 (嗔) Debuff: 暴躁狀態。移動路徑發生隨機偏移。
                        if (roleTrait?.name === '孫悟空' && roleTrait?.isCursed) {
                            const drift = [
                                { q: 1, r: -1 }, { q: 1, r: 0 }, { q: 0, r: 1 },
                                { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }
                            ];
                            const rand = drift[Math.floor(Math.random() * drift.length)];
                            targetQ += rand.q;
                            targetR += rand.r;
                        }

                        // Ensure target is still within map bounds
                        const targetHexData = fullGrid.find(h => h.q === targetQ && h.r === targetR);
                        if (!targetHexData) return;

                        // Block impassable terrain (世界樹根 / 世界樹盤根 etc.；孫悟空可穿越黑曜石但不可停留)
                        if (isHexImpassable(targetHexData.terrainId, true)) {
                            onShowMessage('此地形無法通行！', 'error');
                            return;
                        }

                        const dist = getHexDist(userData.CurrentQ, userData.CurrentR, targetQ, targetR);
                        if (dist === 0) return;

                        // 豬八戒 (貪) Debuff: 懶惰狀態。移動消耗加倍。（i5 步雲履免疫）
                        let finalCost = dist;
                        if (roleTrait?.name === '豬八戒' && roleTrait?.isCursed && !ignoreTerrainThisTurn) {
                            finalCost = Math.ceil(dist * 1.5);
                        }

                        // 荊棘叢 (Thorns): 進入荊棘格額外消耗 +1 AP（i5 步雲履免疫）
                        if (targetHexData?.terrainId === 'thorns' && !ignoreTerrainThisTurn) {
                            finalCost += 1;
                        }

                        if (finalCost <= stepsRemaining) {
                            // Determine if path intercepts any monster
                            let actualTargetQ = targetQ;
                            let actualTargetR = targetR;
                            let actualCost = finalCost;

                            const path = hexLineDraw({ q: userData.CurrentQ, r: userData.CurrentR }, { q: targetQ, r: targetR });
                            const allEntitiesForCollision = [...dbEntities.filter(e => e.is_active !== false && e.type !== 'personal')];
                            let blockedByMonster = false;
                            let triggerDeepBog = false;

                            // 輕盈 Buff (q6/q7): immunity to 深淵泥淖
                            const hasLightnessBuff = todayCompletedQuestIds.includes('q6') ||
                                todayCompletedQuestIds.includes('q7');

                            for (let i = 1; i < path.length; i++) {
                                const step = path[i];

                                // Impassable terrain: stop at previous step (孫悟空可穿越黑曜石，但不能以黑曜石為終點)
                                const stepHex = fullGrid.find(h => h.q === step.q && h.r === step.r);
                                const isLastStep = i === path.length - 1;
                                if (isHexImpassable(stepHex?.terrainId, isLastStep)) {
                                    const prevStep = path[i - 1];
                                    actualTargetQ = prevStep.q;
                                    actualTargetR = prevStep.r;
                                    const stepDist = getHexDist(userData.CurrentQ, userData.CurrentR, actualTargetQ, actualTargetR);
                                    if (stepDist === 0) {
                                        onShowMessage('前方道路被阻擋！', 'error');
                                        return;
                                    }
                                    actualCost = roleTrait?.name === '豬八戒' && roleTrait?.isCursed ? Math.ceil(stepDist * 1.5) : stepDist;
                                    break;
                                }

                                // 深淵泥淖 (Deep Bog): 踏入後強制停止。輕盈 Buff (q6/q7) 免疫
                                if (stepHex?.terrainId === 'deep_bog' && !hasLightnessBuff && !ignoreTerrainThisTurn) {
                                    actualTargetQ = step.q;
                                    actualTargetR = step.r;
                                    const stepDist = getHexDist(userData.CurrentQ, userData.CurrentR, actualTargetQ, actualTargetR);
                                    actualCost = roleTrait?.name === '豬八戒' && roleTrait?.isCursed ? Math.ceil(stepDist * 1.5) : stepDist;
                                    triggerDeepBog = true;
                                    break;
                                }

                                const monsterNearby = allEntitiesForCollision.find(e => e.type === 'monster' && getHexDist(step.q, step.r, e.q, e.r) <= 1);
                                if (monsterNearby) {
                                    // Intercept! Stop at this step.
                                    actualTargetQ = step.q;
                                    actualTargetR = step.r;
                                    const stepDist = getHexDist(userData.CurrentQ, userData.CurrentR, actualTargetQ, actualTargetR);
                                    actualCost = roleTrait?.name === '豬八戒' && roleTrait?.isCursed ? Math.ceil(stepDist * 1.5) : stepDist;
                                    blockedByMonster = true;
                                    break;
                                }
                            }

                            // Determine facing direction based on movement
                            const newFacing = getHexDirection(userData.CurrentQ, userData.CurrentR, actualTargetQ, actualTargetR);
                            setFacing(newFacing >= 0 ? newFacing : 0);

                            // 平滑鏡冰 (Slippery Ice): forced slide in movement direction until hitting impassable/boundary
                            // 謙卑 Buff (q5 completed) 或 定心杵技能 grants immunity
                            const hasHumilityBuff = todayCompletedQuestIds.includes('q5');
                            const landingHex = fullGrid.find(h => h.q === actualTargetQ && h.r === actualTargetR);
                            if (landingHex?.terrainId === 'slippery_slope' && !hasHumilityBuff && !dingXinZhuActive) {
                                const slideDir = newFacing >= 0 ? newFacing : getClosestHexDir(userData.CurrentQ, userData.CurrentR, actualTargetQ, actualTargetR);
                                const dir = HEX_DIRECTIONS[slideDir];
                                let slideQ = actualTargetQ;
                                let slideR = actualTargetR;
                                let slid = false;
                                while (true) {
                                    const nextQ = slideQ + dir.q;
                                    const nextR = slideR + dir.r;
                                    const nextHex = fullGrid.find(h => h.q === nextQ && h.r === nextR);
                                    if (!nextHex || TERRAIN_TYPES[nextHex.terrainId ?? '']?.impassable) break;
                                    const blockedByEntity = allEntitiesForCollision.find(e => e.q === nextQ && e.r === nextR);
                                    if (blockedByEntity) break;
                                    slideQ = nextQ;
                                    slideR = nextR;
                                    slid = true;
                                }
                                if (slid) {
                                    actualTargetQ = slideQ;
                                    actualTargetR = slideR;
                                    onShowMessage('平滑鏡冰！你在冰面上失控滑行！', 'info');
                                }
                            }

                            const finalHexData = fullGrid.find(h => h.q === actualTargetQ && h.r === actualTargetR) || targetHexData;
                            onMoveCharacter(actualTargetQ, actualTargetR, actualCost, finalHexData.zoneId, newFacing);

                            // Optimistically update facing locally and to parent
                            onUpdateUserData({ Facing: newFacing });

                            // 白龍馬 龍騰：移動後有剩餘 AP 時開放轉讓
                            const remainingAfterMove = stepsRemaining - actualCost;
                            if (userData.Role === '白龍馬' && (userData.Streak ?? 0) >= 3 && remainingAfterMove > 0) {
                                setDragonSoarPending(true);
                            }

                            // 定心杵：若已激活，此次移動後清除（保護一次）
                            if (dingXinZhuActive && landingHex?.terrainId === 'slippery_slope') {
                                setDingXinZhuActive(false);
                                setNoCritIncoming(false);
                                onShowMessage('定心杵護身！滑行被抵消。', 'info');
                            }

                            // 深淵泥淖：強制消耗剩餘 AP，並通知 page.tsx 設下回合減半
                            if (triggerDeepBog) {
                                onUpdateSteps?.(0);
                                onDeepBog?.();
                            }

                            if (finalHexData.terrainId === 'thorns') {
                                onShowMessage('荊棘遍地！費盡力氣才踏入此格，額外消耗 1 AP。', 'info');
                            }

                            if (blockedByMonster) {
                                onShowMessage("強大的妖氣逼近！你被迫停下了腳步！", "error");
                            } else if (targetQ !== hex.q || targetR !== hex.r) {
                                onShowMessage("緊箍咒發作！暴躁的心讓你偏離了原本的路線！", "error");
                            }
                        } else {
                            onShowMessage(`能量不足！此步需要 ${finalCost} 點 (受天賦/地形影響)，目前僅餘 ${stepsRemaining}。`, 'error');
                        }
                    }
                }
            }
        }
    }, [getCurrentPointerHex, stepsRemaining, userData, onMoveCharacter, roleTrait, fullGrid, onShowMessage, dbEntities, isPlanningMode, plannedPath, todayCompletedQuestIds, getClosestHexDir]);

    const handleExecutePlannedPath = useCallback(() => {
        if (plannedPath.length === 0) return;

        let finalPath = [...plannedPath];
        if (roleTrait?.name === '孫悟空' && roleTrait?.isCursed) {
            const drifts = [{ q: 1, r: -1 }, { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }];
            const rand = drifts[Math.floor(Math.random() * drifts.length)];
            const last = finalPath[finalPath.length - 1];
            finalPath[finalPath.length - 1] = { q: last.q + rand.q, r: last.r + rand.r };
            onShowMessage('🐒 受詛咒的悟空偏離了目標！', 'info');
        }

        const isCursedPig = roleTrait?.name === '豬八戒' && roleTrait?.isCursed;
        const activeMonsters = dbEntities.filter(e => e.is_active !== false && e.type === 'monster');
        let finalIdx = finalPath.length - 1;
        let triggerDeepBogPlanned = false;

        // 輕盈 Buff (q6/q7): immunity to 深淵泥淖
        const hasLightnessBuff = todayCompletedQuestIds.includes('q6') || todayCompletedQuestIds.includes('q7');

        for (let i = 0; i < finalPath.length; i++) {
            const step = finalPath[i];
            const stepHex = fullGrid.find(h => h.q === step.q && h.r === step.r);
            // 深淵泥淖：路徑中途遇到，立即截斷
            if (stepHex?.terrainId === 'deep_bog' && !hasLightnessBuff && !ignoreTerrainThisTurn) {
                finalIdx = i;
                triggerDeepBogPlanned = true;
                break;
            }
            const monsterNearby = activeMonsters.find(e => getHexDist(step.q, step.r, e.q, e.r) <= 1);
            if (monsterNearby) { finalIdx = i; break; }
        }

        let targetQ = finalPath[finalIdx].q;
        let targetR = finalPath[finalIdx].r;
        const rawCost = finalIdx + 1;
        const landingIsThorns = !ignoreTerrainThisTurn && fullGrid.find(h => h.q === targetQ && h.r === targetR)?.terrainId === 'thorns';
        const actualCost = ((isCursedPig && !ignoreTerrainThisTurn) ? Math.ceil(rawCost * 1.5) : rawCost) + (landingIsThorns ? 1 : 0);
        const newFacing = getHexDirection(userData.CurrentQ, userData.CurrentR, targetQ, targetR);

        // 平滑鏡冰 (Slippery Ice): forced slide unless 謙卑 Buff (q5 completed)
        const hasHumilityBuff = todayCompletedQuestIds.includes('q5');
        const landingHex = fullGrid.find(h => h.q === targetQ && h.r === targetR);
        if (landingHex?.terrainId === 'slippery_slope' && !hasHumilityBuff) {
            const slideDir = newFacing >= 0 ? newFacing : getClosestHexDir(userData.CurrentQ, userData.CurrentR, targetQ, targetR);
            const dir = HEX_DIRECTIONS[slideDir];
            let slideQ = targetQ;
            let slideR = targetR;
            let slid = false;
            while (true) {
                const nextQ = slideQ + dir.q;
                const nextR = slideR + dir.r;
                const nextHex = fullGrid.find(h => h.q === nextQ && h.r === nextR);
                if (!nextHex || TERRAIN_TYPES[nextHex.terrainId ?? '']?.impassable) break;
                const blockedByEntity = activeMonsters.find(e => e.q === nextQ && e.r === nextR);
                if (blockedByEntity) break;
                slideQ = nextQ;
                slideR = nextR;
                slid = true;
            }
            if (slid) {
                targetQ = slideQ;
                targetR = slideR;
                onShowMessage('平滑鏡冰！你在冰面上失控滑行！', 'info');
            }
        }

        if (actualCost > stepsRemaining) {
            onShowMessage(`能量不足！此步需要 ${actualCost} 點（含荊棘地形），目前僅餘 ${stepsRemaining}。`, 'error');
            setPlannedPath([]);
            setIsPlanningMode(false);
            return;
        }

        const finalHexData = fullGrid.find(h => h.q === targetQ && h.r === targetR);
        if (landingIsThorns) {
            onShowMessage('荊棘遍地！費盡力氣才踏入此格，額外消耗 1 AP。', 'info');
        }
        onMoveCharacter(targetQ, targetR, actualCost, finalHexData?.zoneId, newFacing);

        // 深淵泥淖：強制消耗剩餘 AP，並通知 page.tsx 設下回合減半
        if (triggerDeepBogPlanned) {
            onUpdateSteps?.(0);
            onDeepBog?.();
        }

        setPlannedPath([]);
        setIsPlanningMode(false);
    }, [plannedPath, roleTrait, dbEntities, fullGrid, stepsRemaining, userData, onMoveCharacter, onShowMessage, todayCompletedQuestIds, getClosestHexDir]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        setZoom(prev => Math.min(Math.max(0.3, prev - Math.sign(e.deltaY) * 0.1), 6));
    }, []);

    // Player Pixel
    const playerPixel = useMemo(() => {
        return axialToPixelPos(userData.CurrentQ, userData.CurrentR, HEX_SIZE_WORLD);
    }, [userData.CurrentQ, userData.CurrentR, HEX_SIZE_WORLD]);

    return (
        <div className="absolute inset-0 bg-slate-950 flex flex-col overflow-hidden animate-in fade-in">
            {/* Header — floats over map on mobile, solid bar on desktop */}
            <header className="px-3 py-2 md:px-6 md:py-4 border-b border-white/10 flex justify-between items-center z-20 shadow-2xl
                absolute top-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md
                md:relative md:bg-slate-900 md:backdrop-blur-none md:shrink-0">
                <div className="hidden md:flex items-center gap-3">
                    <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg border border-emerald-400/20"><MapIcon size={20} /></div>
                    <div className="text-left text-white font-black text-xl tracking-widest uppercase">心蓮六瓣 <span className="opacity-50 text-xs">// World Map</span></div>
                </div>
                {/* Mobile: show map icon only */}
                <div className="flex md:hidden items-center">
                    <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-lg border border-emerald-400/20"><MapIcon size={16} /></div>
                </div>
                <div className="flex gap-1.5 md:gap-2">
                    <button aria-label="世界全景" onClick={() => setIsOverviewOpen(true)} className="flex items-center justify-center p-2 md:p-3 bg-sky-600/20 text-sky-400 hover:bg-sky-600 hover:text-white rounded-xl md:rounded-2xl transition-all border border-sky-500/20 active:scale-95 shadow-lg">
                        <Globe size={18} />
                    </button>
                    <button aria-label="商店" onClick={() => setIsShopOpen(true)} className="flex items-center justify-center p-2 md:p-3 bg-orange-600/20 text-orange-400 hover:bg-orange-600 hover:text-white rounded-xl md:rounded-2xl transition-all border border-orange-500/20 active:scale-95 shadow-lg relative">
                        <Store size={18} />
                    </button>
                    <button aria-label="道具欄" onClick={() => setIsInventoryOpen(true)} className="flex items-center justify-center p-2 md:p-3 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl md:rounded-2xl transition-all border border-indigo-500/20 active:scale-95 shadow-lg relative">
                        <Package size={18} />
                        {userData.GameInventory && userData.GameInventory.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
                        )}
                    </button>
                    {(userData.Streak ?? 0) >= 3 && (
                        <button aria-label="技能" onClick={() => setIsSkillPanelOpen(v => !v)} className={`flex items-center justify-center p-2 md:p-3 rounded-xl md:rounded-2xl transition-all border active:scale-95 shadow-lg relative ${isSkillPanelOpen ? 'bg-yellow-500 text-white border-yellow-400' : 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600 hover:text-white border-yellow-500/20'}`}>
                            <span className="text-base leading-none">✦</span>
                            {dragonSoarPending && <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full border-2 border-slate-900 animate-pulse"></span>}
                        </button>
                    )}
                    <button aria-label="返回定課" onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 md:px-6 md:py-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl md:rounded-2xl transition-all border border-white/10 shadow-xl active:scale-95 text-xs md:text-sm"><ChevronLeft size={14} /> <span className="hidden md:inline">返回定課</span><span className="md:hidden">返回</span></button>
                </div>
            </header>

            {/* Main Map Container */}
            <main
                className="flex-1 bg-[#040407] overflow-hidden relative cursor-grab active:cursor-grabbing text-neutral-100 touch-none pt-[42px] md:pt-0"
                ref={mapContainerRef}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={() => { isDragging.current = false; setHoveredHexKey(null); }}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                onTouchCancel={() => { isDragging.current = false; }}
                onWheel={handleWheel}
            >
                {/* Hardware Accelerated Canvas Container */}
                <div
                    className="absolute top-1/2 left-1/2"
                    style={{
                        width: `${VIRTUAL_MAP_SIZE}px`,
                        height: `${VIRTUAL_MAP_SIZE}px`,
                        marginLeft: `${-VIRTUAL_MAP_SIZE / 2}px`,
                        marginTop: `${-VIRTUAL_MAP_SIZE / 2}px`,
                        transform: `translate(${camX * zoom}px, ${camY * zoom}px) scale(${zoom})`,
                        transformOrigin: '50% 50%',
                    }}
                >
                    <svg
                        className="w-full h-full select-none"
                        viewBox={`${-VIRTUAL_MAP_SIZE / 2} ${-VIRTUAL_MAP_SIZE / 2} ${VIRTUAL_MAP_SIZE} ${VIRTUAL_MAP_SIZE}`}
                    >
                        {/* 1. Static Layout Grid (Outer Performance Ring that is blurry while moving) */}
                        <g style={{ willChange: 'transform' }}>
                            <StaticMapLayer grid={perfLayerGrid} />
                        </g>

                        {/* 2. Static Layout Grid (Inner Crisp Ring) */}
                        <StaticMapLayer grid={crispLayerGrid} />

                        {/* 2. Dynamic Overlay (Hover, Move Range) */}
                        <DynamicOverlayLayer
                            grid={fullGrid}
                            userData={userData}
                            stepsRemaining={stepsRemaining}
                            hoveredHexKey={hoveredHexKey}
                        />

                        {/* 2.5 Entities Layer (Monsters, Chests, Encounters) */}
                        <g style={{ pointerEvents: 'none' }}>
                            {dbEntities.filter(e => e.type !== 'personal' && e.type !== 'teammate' && getHexDist(initialQ, initialR, e.q, e.r) <= 20).map((e) => {
                                const pos = axialToPixelPos(e.q, e.r, DEFAULT_CONFIG.HEX_SIZE_WORLD);
                                if (e.type === 'monster') {
                                    const imgSrc = getMonsterImageSrc(e.data?.type, e.data?.zone);
                                    const W = 16, H = 16;
                                    return (
                                        <image
                                            key={`db_ent_${e.id}`}
                                            href={imgSrc ?? ''}
                                            x={pos.x - W / 2} y={pos.y - H}
                                            width={W} height={H}
                                            preserveAspectRatio="xMidYMax meet"
                                            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))' }}
                                        />
                                    );
                                }
                                if (e.type === 'treasure') {
                                    const chestImg = e.data?.worldState === 'good'
                                        ? '/images/chests/chest_golden.png'
                                        : '/images/chests/chest_normal.png';
                                    const W = 7, H = 7;
                                    return (
                                        <g key={`db_ent_${e.id}`}>
                                            <image
                                                href={chestImg}
                                                x={pos.x - W / 2} y={pos.y - H / 2 - 3}
                                                width={W} height={H}
                                                preserveAspectRatio="xMidYMid meet"
                                                style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }}
                                            />
                                            {/* 行動裝置觸控輔助區域 (透明擴大點擊範圍) */}
                                            <rect
                                                x={pos.x - 22} y={pos.y - 22}
                                                width={44} height={44}
                                                fill="transparent"
                                                style={{ pointerEvents: 'none' }}
                                            />
                                        </g>
                                    );
                                }
                                return (
                                    <text key={`db_ent_${e.id}`} x={pos.x} y={pos.y + 3} textAnchor="middle" fontSize={7} className="drop-shadow-md">
                                        {e.icon}
                                    </text>
                                );
                            })}
                            {/* Teammates Layer */}
                            {dbEntities.filter(e => e.type === 'teammate').map((e) => {
                                const pos = axialToPixelPos(e.q, e.r, DEFAULT_CONFIG.HEX_SIZE_WORLD);
                                const dist = getHexDist(userData.CurrentQ, userData.CurrentR, e.q, e.r);
                                return (
                                    <g key={`tm_${e.id}`} transform={`translate(${pos.x}, ${pos.y})`} style={{ cursor: dist <= 2 ? 'pointer' : 'default', pointerEvents: 'auto' }}>
                                        <circle r={10} fill="rgba(96, 165, 250, 0.3)" className="animate-ping" />
                                        {e.data?.role && ROLE_CURE_MAP[e.data.role] ? (
                                            <image
                                                href={`/images/map-sprites/${e.data.role}.png`}
                                                x={-12}
                                                y={-36}
                                                width={24}
                                                height={36}
                                                preserveAspectRatio="xMidYMax meet"
                                                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))' }}
                                            />
                                        ) : (
                                            <>
                                                <circle r={7} fill="rgba(59, 130, 246, 0.8)" stroke="white" strokeWidth={1} />
                                                <text y={4} textAnchor="middle" fontSize={11} className="drop-shadow-lg">{e.icon}</text>
                                            </>
                                        )}
                                        <text y={11} textAnchor="middle" fontSize={7} fill="#93c5fd" fontWeight="bold" className="drop-shadow">{e.name}</text>
                                    </g>
                                );
                            })}
                        </g>

                        {/* 2.7 Planned Path Overlay */}
                        {isPlanningMode && plannedPath.map((ph, idx) => {
                            const pos = axialToPixelPos(ph.q, ph.r, DEFAULT_CONFIG.HEX_SIZE_WORLD);
                            const isLast = idx === plannedPath.length - 1;
                            return (
                                <g key={`plan_${idx}`} style={{ pointerEvents: 'none' }}>
                                    <polygon
                                        points={getHexPointsStr(pos.x, pos.y, DEFAULT_CONFIG.HEX_SIZE_WORLD * 1.01)}
                                        fill={isLast ? 'rgba(56,189,248,0.5)' : 'rgba(56,189,248,0.25)'}
                                        stroke="rgba(56,189,248,0.9)"
                                        strokeWidth="1.5"
                                    />
                                    <text x={pos.x} y={pos.y + 3} textAnchor="middle" fontSize={6} fill="white" fontWeight="900" style={{ pointerEvents: 'none' }}>
                                        {idx + 1}
                                    </text>
                                </g>
                            );
                        })}

                        {/* 3. Player Character — avatar & name only; HUD is HTML overlay below */}
                        <g transform={`translate(${playerPixel.x}, ${playerPixel.y})`}>
                            {ROLE_CURE_MAP[userData.Role] ? (
                                <image
                                    href={`/images/map-sprites/${userData.Role}.png`}
                                    x={-12}
                                    y={-36}
                                    width={24}
                                    height={36}
                                    preserveAspectRatio="xMidYMax meet"
                                    style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))' }}
                                />
                            ) : (
                                <text y={-4} textAnchor="middle" fontSize={18} dominantBaseline="auto" style={{ userSelect: 'none' }}>
                                    {ROLE_CURE_MAP[userData.Role]?.avatar || '👤'}
                                </text>
                            )}
                            <text y={11} textAnchor="middle" fontSize={8} fontWeight="900" fill="white" style={{ textShadow: '0 2px 4px black, 0 -1px 2px black' }}>{userData.Name}</text>
                        </g>
                    </svg>
                </div>

                {/* Player Dice HUD — fixed bottom-right, avoids covering character name */}
                {(() => {
                    return (
                        <div
                            ref={hudRef}
                            className="absolute pointer-events-auto z-20 flex flex-col items-end"
                            style={{ right: 12, bottom: 12 }}
                            onMouseDown={e => e.stopPropagation()}
                            onMouseUp={e => e.stopPropagation()}
                            onTouchStart={e => e.stopPropagation()}
                            onTouchEnd={e => e.stopPropagation()}
                        >
                            <div
                                className={`mt-6 p-3 rounded-[2rem] bg-slate-900/80 border ${moveMultiplier && moveMultiplier > 1 ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)] animate-pulse' : 'border-white/10 shadow-2xl'} backdrop-blur-xl flex flex-col gap-2 md:gap-3 items-center pointer-events-auto relative`}
                                style={{ width: 'min(170px, 45vw)' }}
                            >
                                {moveMultiplier && moveMultiplier > 1 && (
                                    <div className="absolute -top-3 bg-yellow-400 text-black px-3 py-0.5 rounded-full text-xs font-black tracking-widest flex items-center gap-1 shadow-lg shadow-yellow-500/50">
                                        ⚡ 衝刺 x{moveMultiplier}
                                    </div>
                                )}
                                {/* AP display */}
                                <div className="w-full flex flex-col items-center gap-1">
                                    <div className="flex items-center justify-between w-full px-1">
                                        <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">移動 AP</span>
                                        <span className={`text-[11px] font-black tabular-nums ${stepsRemaining > 0 ? 'text-cyan-400' : 'text-slate-600'}`}>{stepsRemaining}</span>
                                    </div>
                                    <div className="flex gap-0.5 w-full">
                                        {Array.from({ length: Math.min(10, Math.max(stepsRemaining, 1)) }).map((_, i) => (
                                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-200 ${i < stepsRemaining ? 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.7)]' : 'bg-slate-800'}`} />
                                        ))}
                                        {stepsRemaining > 10 && <div className="h-1.5 flex-1 rounded-full bg-cyan-300 opacity-60" />}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    <button aria-label="減少骰數" onClick={() => setRollAmount(p => Math.max(1, p - 1))} className="w-11 h-11 rounded-full bg-slate-950 border border-white/5 text-slate-400 flex items-center justify-center font-black active:scale-90 hover:bg-slate-800 hover:text-white transition-all"><Minus size={16} /></button>
                                    <div className="font-black text-emerald-400 tracking-widest text-lg">x {rollAmount}</div>
                                    <button aria-label="增加骰數" onClick={() => setRollAmount(p => Math.min(userData.EnergyDice, p + 1))} className="w-11 h-11 rounded-full bg-slate-950 border border-white/5 text-slate-400 flex items-center justify-center font-black active:scale-90 hover:bg-slate-800 hover:text-white transition-all"><Plus size={16} /></button>
                                </div>
                                {/* Movement mode toggle — only when AP available */}
                                {stepsRemaining > 0 && (
                                    <div className="flex gap-2 w-full">
                                        <button
                                            onClick={() => { setIsPlanningMode(false); setPlannedPath([]); }}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${!isPlanningMode ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                                        >
                                            🎯 自動
                                        </button>
                                        <button
                                            onClick={() => setIsPlanningMode(true)}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${isPlanningMode ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                                        >
                                            🗺️ 規劃
                                        </button>
                                    </div>
                                )}
                                {/* Planning controls */}
                                {isPlanningMode && stepsRemaining > 0 && (
                                    <div className="w-full space-y-1.5">
                                        <div className="text-[9px] text-sky-400 font-black text-center tracking-widest">
                                            已規劃 {plannedPath.length} 步（點最後一格取消）
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setPlannedPath([])}
                                                className="flex-1 py-2 rounded-xl text-xs font-black bg-slate-800 text-slate-400 active:scale-95 transition-all"
                                            >
                                                🗑️ 清除
                                            </button>
                                            <button
                                                disabled={plannedPath.length === 0}
                                                onClick={handleExecutePlannedPath}
                                                className="flex-[2] py-2 rounded-xl text-xs font-black bg-sky-600 text-white shadow-lg active:scale-95 disabled:opacity-40 transition-all"
                                            >
                                                ✅ 執行移動
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => onRollDice(rollAmount)}
                                    disabled={isRolling || stepsRemaining > 0 || userData.EnergyDice < rollAmount}
                                    className={`w-full py-2.5 rounded-2xl text-[10px] uppercase font-black flex items-center justify-center gap-2 transition-all ${(isRolling || stepsRemaining > 0 || userData.EnergyDice < rollAmount) ? 'bg-slate-950 border border-white/5 text-slate-600' : 'bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/20 active:scale-95'}`}
                                >
                                    {isRolling ? <Loader2 size={12} className="animate-spin" /> : <Dice5 size={12} />} 注入能量轉輪
                                </button>
                                {(userData.GoldenDice || 0) > 0 && (
                                    <button
                                        onClick={() => onRollDice(-1)}
                                        disabled={isRolling || stepsRemaining > 0}
                                        className={`w-full py-1.5 rounded-xl text-[9px] uppercase font-black flex items-center justify-center gap-1 transition-all ${(isRolling || stepsRemaining > 0) ? 'bg-slate-950 border border-yellow-700/50 text-slate-600' : 'bg-gradient-to-r from-yellow-600 to-amber-500 text-black shadow-lg shadow-yellow-500/30 active:scale-95'}`}
                                    >
                                        🌟 使用萬能奇蹟骰 ({userData.GoldenDice})
                                    </button>
                                )}
                                {(userData.GoldenDice || 0) > 0 && (
                                    <button
                                        onClick={onExchangeGoldenDice}
                                        disabled={isRolling}
                                        className={`w-full py-1.5 rounded-xl text-[9px] uppercase font-black flex items-center justify-center gap-1 transition-all ${isRolling ? 'bg-slate-950 border border-amber-700/50 text-slate-600' : 'bg-gradient-to-r from-amber-800 to-yellow-700 text-amber-200 shadow-lg shadow-amber-900/30 active:scale-95'}`}
                                    >
                                        ✦ 兌換能源骰 ×3 (⭐→🎲🎲🎲)
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* HUD Info */}
                {(() => {
                    const roleConfig = ROLE_CURE_MAP[userData.Role] || ROLE_CURE_MAP['孫悟空'];
                    const maxHP = roleConfig.baseHP + (userData.Physique * roleConfig.hpScale);
                    const currentHP = userData.HP ?? maxHP;
                    const atk = (userData.Level * 10) + (userData.Physique * 2);
                    const def = roleConfig.baseDEF + userData.Physique;
                    const hpPct = Math.max(0, Math.min(1, currentHP / maxHP));
                    const hpColor = hpPct > 0.6 ? 'text-emerald-400' : hpPct > 0.3 ? 'text-yellow-400' : 'text-red-400';
                    return (
                        <div
                            ref={statsHudRef}
                            className="absolute bottom-4 left-3 bg-slate-900/80 p-2.5 md:p-4 rounded-2xl md:rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl select-none pointer-events-auto md:pointer-events-none z-30 space-y-2 md:space-y-3 min-w-[130px] md:min-w-[160px] cursor-pointer md:cursor-default"
                            onClick={() => setIsStatsExpanded(p => !p)}
                            onMouseDown={e => e.stopPropagation()}
                            onMouseUp={e => e.stopPropagation()}
                            onTouchStart={e => e.stopPropagation()}
                            onTouchEnd={e => e.stopPropagation()}
                        >
                            {/* HP bar */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">❤️ 血量</span>
                                    <span className={`text-xs font-black ${hpColor}`}>{currentHP} / {maxHP}</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${hpPct > 0.6 ? 'bg-emerald-500' : hpPct > 0.3 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${hpPct * 100}%` }} />
                                </div>
                            </div>
                            {/* ATK / DEF — hidden on mobile when collapsed */}
                            <div className={`${isStatsExpanded ? 'flex' : 'hidden md:flex'} items-center gap-4`}>
                                <div>
                                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-0.5">⚔️ 攻擊</div>
                                    <div className="text-sm font-black text-orange-400">{atk}</div>
                                </div>
                                <div className="h-6 w-px bg-white/10" />
                                <div>
                                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-0.5">🛡️ 防禦</div>
                                    <div className="text-sm font-black text-sky-400">{def}</div>
                                </div>
                                <div className="h-6 w-px bg-white/10" />
                                <div>
                                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-0.5"><Dice5 size={9} className="inline" /> 骰子</div>
                                    <div className="text-sm font-black text-amber-400">{userData.EnergyDice}</div>
                                </div>
                            </div>
                            {/* Coordinates — hidden on mobile to save space */}
                            <div className="hidden md:flex items-center gap-1.5 text-[9px] text-slate-600 font-mono">
                                <Footprints size={10} /> {userData.CurrentQ}, {userData.CurrentR}
                            </div>
                            {/* Mobile expand hint */}
                            <div className="flex md:hidden justify-center mt-0.5">
                                <span className="text-[8px] text-slate-600">{isStatsExpanded ? '▲ 收合' : '▼ 展開'}</span>
                            </div>
                        </div>
                    );
                })()}

                {/* Recenter button — appears when player has panned away from character */}
                {(Math.abs(camX + playerPixel.x) > 10 || Math.abs(camY + playerPixel.y) > 10) && (
                    <button
                        ref={recenterBtnRef}
                        className="absolute top-[52px] md:bottom-6 md:top-auto left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900/90 border border-white/10 text-cyan-400 text-[11px] font-black shadow-xl backdrop-blur-xl active:scale-95 transition-all"
                        onClick={() => { setCamX(-playerPixel.x); setCamY(-playerPixel.y); }}
                        onMouseDown={e => e.stopPropagation()}
                        onMouseUp={e => e.stopPropagation()}
                        onTouchStart={e => e.stopPropagation()}
                        onTouchEnd={e => e.stopPropagation()}
                    >
                        <LocateFixed size={13} /> 回到角色
                    </button>
                )}
            </main>

            {/* Hover Tooltip for Entities */}
            {hoveredHexPos && (() => {
                const targetEntity = dbEntities.find(e => e.q === hoveredHexPos.q && e.r === hoveredHexPos.r);
                if (!targetEntity) return null;

                const isObscured = (roleTrait?.name === '沙悟淨' && roleTrait?.isCursed) ||
                    (targetEntity.type === 'monster' && isFogEntityObscured(targetEntity.q, targetEntity.r));
                const monsterLevel = targetEntity.data?.level || 1;
                const monsterHP = targetEntity.data?.hp || 100;
                const monsterATK = monsterLevel * 12;

                return (
                    <div
                        className="fixed z-50 pointer-events-none bg-slate-900/95 border border-slate-700 p-4 rounded-2xl shadow-2xl backdrop-blur-md min-w-[200px]"
                        style={{
                            left: hoveredHexPos.x + 20,
                            top: hoveredHexPos.y + 20,
                            // Ensure tooltip stays on screen
                            transform: `translate(${hoveredHexPos.x > window.innerWidth - 220 ? '-120%' : '0'}, ${hoveredHexPos.y > window.innerHeight - 150 ? '-120%' : '0'})`
                        }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl drop-shadow-md">{targetEntity.icon}</span>
                            <div className="font-black text-white">{targetEntity.name}</div>
                        </div>
                        {targetEntity.type === 'monster' ? (
                            <div className="space-y-1 mt-2 border-t border-white/10 pt-2">
                                {isObscured ? (
                                    <div className="text-slate-400 text-xs font-bold py-2 flex gap-2 items-center">
                                        {isFogEntityObscured(targetEntity.q, targetEntity.r) ? '🌫️ 迷霧遮蔽：數值未知' : '⚠️ 戰爭迷霧：數值未知'}
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between text-xs font-bold">
                                            <span className="text-slate-500">等級</span>
                                            <span className="text-white">Lv. {monsterLevel}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold">
                                            <span className="text-slate-500">血量</span>
                                            <span className="text-red-400">{monsterHP}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold">
                                            <span className="text-slate-500">攻擊力</span>
                                            <span className="text-orange-400">{monsterATK}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="text-slate-400 text-xs font-bold py-1">點擊以互動</div>
                        )}
                    </div>
                );
            })()}

            <CombatModal
                isOpen={isCombatModalOpen}
                onClose={() => {
                    if (combatTarget) {
                        setDismissedCombatKeys(prev => new Set(prev).add(getEntityKey(combatTarget)));
                    }
                    setIsCombatModalOpen(false);
                }}
                player={userData}
                targetEntity={combatTarget}
                flankingMultiplier={combatFlankingMultiplier}
                remainingAP={Math.max(1, stepsRemaining)}
                isObscured={(roleTrait?.name === '沙悟淨' && roleTrait?.isCursed) ||
                    (combatTarget ? isFogEntityObscured(combatTarget.q, combatTarget.r) : false)}
                isProcessing={isProcessingItem}
                statBuffMultiplier={(combatStatBuff ? 1.5 : 1.0) * d1CombatBuff}
                hasDeathShield={hasDeathShield}
                isIrritable={isIrritable}
                streak={userData.Streak ?? 0}
                d1StatBuff={d1CombatBuff}
                d2LevelDebuff={d2LevelDebuff}
                noCritIncoming={noCritIncoming}
                onAttack={async () => {
                    if (isProcessingItem || !combatTarget) return;
                    setIsProcessingItem(true);
                    try {
                        // D1 緊箍咒：孫悟空 DEF -30%，需傳入 playerDEFOverride 讓 server 端實際套用
                        let irritableDEFOverride: number | undefined;
                        if (isIrritable) {
                            const roleConfig = ROLE_CURE_MAP[userData.Role] || ROLE_CURE_MAP['孫悟空'];
                            const baseDEF = roleConfig.baseDEF + (userData.Physique ?? 0);
                            irritableDEFOverride = Math.floor(baseDEF * (combatStatBuff ? 1.5 : 1.0) * d1CombatBuff * 0.7);
                        }
                        const res = await resolveCombat({
                            attackerId: userData.UserID,
                            targetId: combatTarget.id ? String(combatTarget.id) : undefined,
                            monsterData: combatTarget.data || { level: 1, hp: 100 },
                            flankingMultiplier: combatFlankingMultiplier,
                            remainingAP: Math.max(1, stepsRemaining),
                            statBuffMultiplier: combatStatBuff ? 1.5 : 1.0,
                            hasDeathShield,
                            sealMonsterPassive,
                            d1StatBuff: d1CombatBuff,
                            monsterLevelDebuff: d2LevelDebuff,
                            noCritIncoming,
                            playerDEFOverride: irritableDEFOverride,
                        });

                        // 戰鬥結束後清除所有戰鬥 buff（無論勝負）
                        setCombatStatBuff(false);
                        setSealMonsterPassive(false);
                        setD1CombatBuff(1.0);
                        setD2LevelDebuff(0);
                        setNoCritIncoming(false);

                        if (!res.success) {
                            onShowMessage(res.error ?? '戰鬥發生錯誤', 'error');
                            setIsCombatModalOpen(false);
                        } else {
                            // i3 錦鑭袈裟：若觸發護身，更新 shield 狀態
                            if (res.deathShieldTriggered) {
                                setHasDeathShield(false);
                                onShowMessage('🥻 錦鑭袈裟護身！致命一擊被化解，保留 1 HP！', 'success');
                            }

                            onShowMessage(res.message ?? '', res.isVictory ? 'success' : 'info');

                            if (res.isVictory && combatTarget.key) {
                                setDismissedCombatKeys(prev => new Set(prev).add(getEntityKey(combatTarget)));
                            }

                            // Close modal BEFORE parent callbacks to avoid stale-state re-render race
                            setIsCombatModalOpen(false);
                            if (onUpdateSteps) onUpdateSteps(0);

                            // Now safe to call parent — local state is already queued
                            onUpdateUserData({
                                HP: res.newHP,
                                ...(res.isVictory ? {
                                    GameGold: (userData.GameGold || 0) + (res.coinReward || 0),
                                    EnergyDice: (userData.EnergyDice || 0) + (res.diceReward || 0),
                                    GoldenDice: (userData.GoldenDice || 0) + (res.goldenDiceReward || 0),
                                } : {}),
                                ...(res.isVictory && combatTarget.id ? { removeEntityId: combatTarget.id } : {})
                            } as any);
                            if (res.isVictory && onEntityTrigger) {
                                onEntityTrigger(combatTarget);
                            }
                            // E6 死亡懲罰：HP 歸零且無死亡護盾，通知 page.tsx 執行懲罰
                            if (res.newHP === 0 && !res.deathShieldTriggered) {
                                onPlayerDeath?.();
                            }
                        }
                    } catch (e: any) {
                        // Defensive: clear buffs and close modal even on unexpected exception
                        setCombatStatBuff(false);
                        setSealMonsterPassive(false);
                        setD1CombatBuff(1.0);
                        setD2LevelDebuff(0);
                        setNoCritIncoming(false);
                        setIsCombatModalOpen(false);
                        onShowMessage(e?.message ?? '戰鬥發生未知錯誤', 'error');
                    } finally {
                        setIsProcessingItem(false);
                    }
                }}
                onCapture={async () => {
                    if (isProcessingItem || !combatTarget) return;
                    setIsProcessingItem(true);
                    // Clear combat buffs regardless of outcome (same as onAttack)
                    setCombatStatBuff(false);
                    setSealMonsterPassive(false);
                    setD1CombatBuff(1.0);
                    setD2LevelDebuff(0);
                    setNoCritIncoming(false);
                    try {
                        const captureRes = await useGameItem(userData.UserID, 'i1');
                        if (!captureRes.success) {
                            onShowMessage(captureRes.error ?? '收妖失敗', 'error');
                            setIsCombatModalOpen(false);
                            return;
                        }
                        const monsterLevel = combatTarget.data?.level || 1;
                        const coinReward = Math.floor(Math.max(monsterLevel, Math.floor(userData.Level * 0.75)) * 20);
                        onShowMessage(captureRes.message ?? `收妖葫蘆發動！${combatTarget.name || '心魔'} 被收服！獲得 ${coinReward} 金幣。`, 'success');
                        setIsCombatModalOpen(false);
                        if (onUpdateSteps) onUpdateSteps(0);
                        const newInv = (userData.GameInventory || []).map((i: any) => i.id === 'i1' ? { ...i, count: i.count - 1 } : i).filter((i: any) => i.count > 0);
                        onUpdateUserData({
                            GameGold: (userData.GameGold || 0) + coinReward,
                            GameInventory: newInv,
                            ...(combatTarget.id ? { removeEntityId: combatTarget.id } : {})
                        } as any);
                        if (combatTarget.key) setDismissedCombatKeys(prev => new Set(prev).add(getEntityKey(combatTarget)));
                        if (onEntityTrigger) onEntityTrigger(combatTarget);
                    } catch (e: any) {
                        setIsCombatModalOpen(false);
                        onShowMessage(e?.message ?? '收妖發生未知錯誤', 'error');
                    } finally {
                        setIsProcessingItem(false);
                    }
                }}
            />

            {/* Skill Panel */}
            {isSkillPanelOpen && (userData.Streak ?? 0) >= 3 && (() => {
                const role = userData.Role;
                const streak = userData.Streak ?? 0;
                const HEX_DIRS_SKILL = [{q:1,r:-1},{q:1,r:0},{q:0,r:1},{q:-1,r:1},{q:-1,r:0},{q:0,r:-1}];
                const dir = HEX_DIRS_SKILL[facing];
                const prajnaLine = dir ? [1,2,3].map(i => ({ q: userData.CurrentQ + dir.q*i, r: userData.CurrentR + dir.r*i })) : [];
                const monstersInLine = dbEntities.filter(e => e.type === 'monster' && e.is_active !== false && prajnaLine.some(h => h.q === e.q && h.r === e.r));
                const teammatesInLine = teamMembers.filter(m => prajnaLine.some(h => h.q === m.CurrentQ && h.r === m.CurrentR));
                const adjacentChest = dbEntities.find(e => e.type === 'chest' && e.is_active !== false && getHexDist(userData.CurrentQ, userData.CurrentR, e.q, e.r) === 1);
                const somersaultUsed = todayCompletedQuestIds.includes('skill_jintoudun');

                return (
                    <div className="absolute top-[56px] md:top-[80px] right-3 md:right-6 z-30 w-72 md:w-80 bg-slate-900/95 border border-yellow-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-md space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-yellow-400 uppercase tracking-widest">✦ 精進氣場技能（連打 {streak} 天）</span>
                            <button onClick={() => setIsSkillPanelOpen(false)} className="text-slate-500 hover:text-white text-xs">✕</button>
                        </div>

                        {role === '孫悟空' && (
                            <div className="bg-slate-800/80 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-white">筋斗雲</span>
                                    <span className="text-[10px] text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">無消耗・1日冷卻</span>
                                </div>
                                <p className="text-[11px] text-slate-400">本回合擲骰結果 ×2</p>
                                <button
                                    disabled={somersaultUsed || isRolling || isProcessingItem}
                                    onClick={async () => {
                                        if (onUpdateMultiplier) onUpdateMultiplier(2);
                                        try {
                                            await recordSomersaultUsed(userData.UserID);
                                            onShowMessage('筋斗雲！本回合擲骰步數翻倍！', 'success');
                                            setIsSkillPanelOpen(false);
                                        } catch (_) {
                                            // Rollback multiplier if DB record fails
                                            if (onUpdateMultiplier) onUpdateMultiplier(1);
                                            onShowMessage('筋斗雲發動失敗，請重試。', 'error');
                                        }
                                    }}
                                    className="w-full py-2 rounded-xl text-xs font-black bg-yellow-600 hover:bg-yellow-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >{somersaultUsed ? '今日已使用' : '發動'}</button>
                            </div>
                        )}

                        {role === '豬八戒' && (
                            <div className="bg-slate-800/80 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-white">九齒釘耙</span>
                                    <span className="text-[10px] text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">消耗 1 AP</span>
                                </div>
                                <p className="text-[11px] text-slate-400">{adjacentChest ? '強制開啟相鄰寶箱，必得 1 能源骰子' : '挖掘當前格（20% 機率獲得金幣）'}</p>
                                <button
                                    disabled={stepsRemaining < 1 || isProcessingItem}
                                    onClick={async () => {
                                        setIsProcessingItem(true);
                                        try {
                                            const res = await useNineToothRake(userData.UserID, adjacentChest?.id ?? null);
                                            onShowMessage(res.message ?? '', 'success');
                                            if (onUpdateSteps) onUpdateSteps(stepsRemaining - 1);
                                            if (res.gotDice) onUpdateUserData({ EnergyDice: (userData.EnergyDice ?? 0) + 1 });
                                            if (res.coinAmount) onUpdateUserData({ Coins: (userData.Coins ?? 0) + res.coinAmount });
                                        } catch (e: any) { onShowMessage(e.message, 'error'); }
                                        finally { setIsProcessingItem(false); setIsSkillPanelOpen(false); }
                                    }}
                                    className="w-full py-2 rounded-xl text-xs font-black bg-orange-600 hover:bg-orange-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >發動</button>
                            </div>
                        )}

                        {role === '沙悟淨' && (
                            <div className="bg-slate-800/80 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-white">定心杵</span>
                                    <span className="text-[10px] text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full">消耗 1 AP</span>
                                </div>
                                <p className="text-[11px] text-slate-400">下次移動：免疫流沙/滑行位移；下次受攻擊：敵方不觸發爆擊</p>
                                <button
                                    disabled={stepsRemaining < 1 || dingXinZhuActive || isProcessingItem}
                                    onClick={() => {
                                        setDingXinZhuActive(true);
                                        setNoCritIncoming(true);
                                        if (onUpdateSteps) onUpdateSteps(stepsRemaining - 1);
                                        onShowMessage('定心杵激活！下次受到的位移與爆擊將被抵消。', 'success');
                                        setIsSkillPanelOpen(false);
                                    }}
                                    className="w-full py-2 rounded-xl text-xs font-black bg-cyan-700 hover:bg-cyan-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >{dingXinZhuActive ? '已激活' : '發動'}</button>
                            </div>
                        )}

                        {role === '白龍馬' && (
                            <div className="bg-slate-800/80 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-white">龍騰</span>
                                    <span className="text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">移動後觸發</span>
                                </div>
                                <p className="text-[11px] text-slate-400">移動後，將剩餘 AP 以 1:1 轉給任意隊友（EnergyDice）</p>
                                {dragonSoarPending && teamMembers.length > 0 ? (
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-blue-300">選擇接收隊友（當前剩餘 {stepsRemaining} AP）：</p>
                                        {teamMembers.map(m => (
                                            <button key={m.UserID}
                                                onClick={async () => {
                                                    if (roleTrait?.isCursed) {
                                                        onShowMessage('傲慢之牆！孤立狀態下無法將 AP 傳送給隊友。', 'error');
                                                        setDragonSoarPending(false);
                                                        setIsSkillPanelOpen(false);
                                                        return;
                                                    }
                                                    setIsProcessingItem(true);
                                                    try {
                                                        await dragonSoarDonate(userData.UserID, m.UserID, stepsRemaining);
                                                        onShowMessage(`龍騰！${stepsRemaining} AP 已轉給 ${m.Name}。`, 'success');
                                                        if (onUpdateSteps) onUpdateSteps(0);
                                                        setDragonSoarPending(false);
                                                    } catch (e: any) { onShowMessage(e.message, 'error'); }
                                                    finally { setIsProcessingItem(false); setIsSkillPanelOpen(false); }
                                                }}
                                                className="w-full py-1.5 rounded-lg text-xs font-bold bg-blue-700 hover:bg-blue-600 text-white transition-colors"
                                            >{m.Name}</button>
                                        ))}
                                        <button onClick={() => { setDragonSoarPending(false); setIsSkillPanelOpen(false); }} className="w-full py-1.5 rounded-lg text-xs text-slate-400 hover:text-white">跳過</button>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-500">{dragonSoarPending ? '無隊友可轉讓' : '移動後自動開放'}</p>
                                )}
                            </div>
                        )}

                        {role === '唐三藏' && (
                            <div className="bg-slate-800/80 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-white">般若咒</span>
                                    <span className="text-[10px] text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-full">消耗 2 AP</span>
                                </div>
                                <p className="text-[11px] text-slate-400">面向方向前 3 格直線：怪物受 神識×10 真傷；隊友回復等量 HP</p>
                                <p className="text-[10px] text-slate-500">前方目標：{monstersInLine.length} 個怪物・{teammatesInLine.length} 位隊友</p>
                                <button
                                    disabled={stepsRemaining < 2 || isProcessingItem}
                                    onClick={async () => {
                                        setIsProcessingItem(true);
                                        try {
                                            const res = await usePrajnaMantra(
                                                userData.UserID,
                                                monstersInLine.map(e => String(e.id)),
                                                teammatesInLine.map(m => m.UserID),
                                            );
                                            onShowMessage(res.message ?? '', 'success');
                                            if (onUpdateSteps) onUpdateSteps(stepsRemaining - 2);
                                        } catch (e: any) { onShowMessage(e.message, 'error'); }
                                        finally { setIsProcessingItem(false); setIsSkillPanelOpen(false); }
                                    }}
                                    className="w-full py-2 rounded-xl text-xs font-black bg-violet-700 hover:bg-violet-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >發動</button>
                            </div>
                        )}

                        {role !== '唐三藏' && (() => {
                            const tangTeammate = teamMembers.find(m => m.Role === '唐三藏');
                            if (!tangTeammate) return null;
                            return (
                                <div className="bg-slate-800/80 rounded-xl p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-black text-white">拉一把</span>
                                        <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">助隊友</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">贈送 1 顆能量骰子給 {tangTeammate.Name}（唐三藏詛咒行動需雙倍骰費）</p>
                                    <button
                                        disabled={(userData.EnergyDice ?? 0) < 1 || isProcessingItem}
                                        onClick={async () => {
                                            setIsProcessingItem(true);
                                            try {
                                                const res = await pullTangSanzang(userData.UserID, tangTeammate.UserID, 1);
                                                if (res.success) {
                                                    onShowMessage(`拉一把！已贈 1 顆骰子給 ${tangTeammate.Name}。`, 'success');
                                                    onUpdateUserData({ EnergyDice: Math.max(0, (userData.EnergyDice ?? 1) - 1) });
                                                } else {
                                                    onShowMessage(res.error ?? '操作失敗', 'error');
                                                }
                                            } catch (e: any) { onShowMessage(e.message, 'error'); }
                                            finally { setIsProcessingItem(false); }
                                        }}
                                        className="w-full py-2 rounded-xl text-xs font-black bg-amber-700 hover:bg-amber-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >贈送 1 骰子</button>
                                </div>
                            );
                        })()}
                    </div>
                );
            })()}

            {/* Game Inventory Modal layer */}
            <GameInventoryModal
                isOpen={isInventoryOpen}
                onClose={() => setIsInventoryOpen(false)}
                userData={userData}
                onUseItem={async (itemId) => {
                    if (isProcessingItem) return;
                    setIsProcessingItem(true);
                    try {
                        const res = await useGameItem(userData.UserID, itemId);
                        if (res.success) {
                            onShowMessage(res.message ?? '道具使用成功', 'success');
                            // Local optimistic update for UI snappiness
                            const newInv = (userData.GameInventory || []).map(i => i.id === itemId ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0);
                            onUpdateUserData({ GameInventory: newInv });

                            // Apply specific item effects to front-end states
                            if (itemId === 'i7') {   // 神行甲馬：本回合擲骰 ×2
                                if (onUpdateMultiplier) onUpdateMultiplier(2);
                            }
                            if (itemId === 'i5') {   // 步雲履：本回合無視地形懲罰
                                setIgnoreTerrainThisTurn(true);
                            }
                            if (itemId === 'i9') {   // 九轉金丹：本場戰鬥全屬性 +50%
                                setCombatStatBuff(true);
                            }
                            if (itemId === 'i3') {   // 錦鑭袈裟：抵擋一次致死傷害
                                setHasDeathShield(true);
                            }
                            if (itemId === 'i2') {   // 火眼金睛：下次開箱跳過 Mimic 判定
                                setMimicImmune(true);
                            }
                            if (itemId === 'i4') {   // 如意金剛琢：本場戰鬥封鎖怪物被動
                                setSealMonsterPassive(true);
                            }
                            if (itemId === 'd1') {   // 五毒精魄：全屬性 +20%，天命任務完成 +40%
                                const cureTaskId = ROLE_CURE_MAP[userData.Role]?.cureTaskId;
                                const hasDestinyToday = !!(cureTaskId && todayCompletedQuestIds?.includes(cureTaskId));
                                setD1CombatBuff(hasDestinyToday ? 1.4 : 1.2);
                            }
                            if (itemId === 'd2') {   // 業障石：本場怪物降 3 等
                                setD2LevelDebuff(3);
                            }
                            if (itemId === 'd4') {   // 混沌碎片：依服務端 outcome 處理
                                const effect = res.itemEffect?.type;
                                if (effect === 'd4_teleport') {
                                    // 隨機傳送到地圖上非中心格
                                    const validHexes = Array.from({ length: 8 }, (_, i) => i + 3)
                                        .flatMap(ring => getHexRegion(ring).map(p => ({ q: userData.CurrentQ + p.q, r: userData.CurrentR + p.r })));
                                    if (validHexes.length > 0) {
                                        const pick = validHexes[Math.floor(Math.random() * validHexes.length)];
                                        onMoveCharacter(pick.q, pick.r, 0);
                                    }
                                } else if (effect === 'd4_shop') {
                                    setIsShopOpen(true);
                                }
                                // d4_clear 已在服務端清除怪物，無需額外客戶端操作
                            }
                            if (itemId === 'd6') {   // 貪狼之爪：下次開箱強制觸發 Mimic
                                setD6ForceMimic(true);
                            }
                            if (itemId === 'i6') {   // 芭蕉扇：開啟方向選擇模式，推走直線怪物 3 格
                                setIsFanDirectionMode(true);
                                setIsInventoryOpen(false);
                                return; // 等待玩家選擇方向，不關閉背包
                            }
                            if (res.itemEffect?.type === 'clear_movement_debuff') { // 觀音甘露水：解除移動減益
                                if (onUpdateMultiplier) onUpdateMultiplier(1);
                            }
                            // Close inventory automatically for convenience
                            setIsInventoryOpen(false);

                        } else {
                            onShowMessage(res.message ?? res.error ?? '道具使用失敗', 'error');
                        }
                    } catch (err: any) {
                        onShowMessage(err.message, 'error');
                    } finally {
                        setIsProcessingItem(false);
                    }
                }}
            />

            {/* NPC Shop Modal layer */}
            <NPCShopModal
                isOpen={isShopOpen}
                onClose={() => setIsShopOpen(false)}
                userData={userData}
                onBuyItem={async (itemId, price) => {
                    if (isProcessingItem) return;
                    setIsProcessingItem(true);
                    try {
                        const res = await buyGameItem(userData.UserID, itemId, price);
                        if (res.success) {
                            onShowMessage(res.message ?? '', 'success');
                            const currentInv = userData.GameInventory || [];
                            const exist = currentInv.find(i => i.id === itemId);
                            const newInv = exist ? currentInv.map(i => i.id === itemId ? { ...i, count: i.count + 1 } : i) : [...currentInv, { id: itemId, count: 1 }];
                            onUpdateUserData({ GameGold: (userData.GameGold || 0) - price, GameInventory: newInv });
                        } else {
                            onShowMessage(res.message ?? res.error ?? '購買失敗', 'error');
                        }
                    } catch (err: any) {
                        onShowMessage(err.message, 'error');
                    } finally {
                        setIsProcessingItem(false);
                    }
                }}
            />

            {/* Teammate Donation Modal */}
            {donationTarget && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setDonationTarget(null)}>
                    <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl shadow-blue-500/10" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-4">
                            <div className="text-3xl mb-2">{donationTarget.icon}</div>
                            <div className="text-lg font-bold text-white">{donationTarget.name}</div>
                            <div className="text-xs text-slate-400">Lv.{donationTarget.data?.level || '?'} · {donationTarget.data?.role || '未知'}</div>
                        </div>
                        <div className="text-center text-sm text-slate-300 mb-4">贈送能源骰子給這位夥伴？</div>
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <button onClick={() => setDonateAmount(p => Math.max(1, p - 1))} className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 text-white flex items-center justify-center"><Minus size={14} /></button>
                            <div className="text-2xl font-black text-blue-400">{donateAmount}</div>
                            <button onClick={() => setDonateAmount(p => Math.min(userData.EnergyDice || 0, p + 1))} className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 text-white flex items-center justify-center"><Plus size={14} /></button>
                        </div>
                        <div className="text-xs text-center text-slate-500 mb-4">你目前有 {userData.EnergyDice || 0} 個能源骰子</div>
                        <div className="flex gap-2">
                            <button onClick={() => setDonationTarget(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-white/5 text-slate-400 text-sm font-bold">取消</button>
                            <button
                                disabled={isDonating || donateAmount <= 0 || (userData.EnergyDice || 0) < donateAmount}
                                onClick={async () => {
                                    if (userData.Role === '白龍馬' && roleTrait?.isCursed) {
                                        onShowMessage('傲慢之牆！孤立狀態下無法贈送骰子給隊友。', 'error');
                                        setDonationTarget(null);
                                        return;
                                    }
                                    setIsDonating(true);
                                    try {
                                        const res = await donateDice(userData.UserID, donationTarget.data.userId, donateAmount);
                                        onShowMessage(res.message ?? '', 'success');
                                        onUpdateUserData({ EnergyDice: (userData.EnergyDice || 0) - donateAmount });
                                        setDonationTarget(null);
                                    } catch (err: any) {
                                        onShowMessage(err.message || '捐贈失敗', 'error');
                                    } finally {
                                        setIsDonating(false);
                                    }
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition-all"
                            >
                                {isDonating ? '處理中...' : `贈送 ${donateAmount} 🎲`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <WorldOverview
                isOpen={isOverviewOpen}
                onClose={() => setIsOverviewOpen(false)}
                mapData={mapData}
                corridorL={corridorL}
                corridorW={corridorW}
                dbEntities={dbEntities ?? []}
                userData={userData}
            />

            {/* I4 黃金骰子加持：開箱確認 Dialog */}
            {pendingChestEntity && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 w-72 shadow-2xl">
                        <div className="text-center mb-4">
                            <div className="text-3xl mb-1">⭐</div>
                            <div className="text-white font-black text-base">使用黃金骰子加持？</div>
                            <div className="text-slate-400 text-xs mt-1">消耗 1 顆黃金骰子，保證獲得最高獎勵（+3 能源骰子）並完全無視寶箱怪</div>
                        </div>
                        <div className="text-center text-xs text-amber-400 mb-4">你目前有 {userData.GoldenDice ?? 0} 顆 ⭐</div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const entity = pendingChestEntity;
                                    setPendingChestEntity(null);
                                    if (entity && onEntityTrigger) onEntityTrigger(entity);
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-white/5 text-slate-400 text-sm font-bold active:scale-95 transition-all"
                            >普通開箱</button>
                            <button
                                onClick={async () => {
                                    const entity = pendingChestEntity;
                                    setPendingChestEntity(null);
                                    try {
                                        await blessChestWithGoldenDice(userData.UserID);
                                        onUpdateUserData({ GoldenDice: Math.max(0, (userData.GoldenDice ?? 0) - 1) });
                                        if (entity && onEntityTrigger) onEntityTrigger(entity);
                                    } catch (err: any) {
                                        onShowMessage(err.message ?? '黃金加持失敗', 'error');
                                        if (entity && onEntityTrigger) onEntityTrigger(entity);
                                    }
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 text-white text-sm font-bold active:scale-95 transition-all"
                            >⭐ 黃金加持</button>
                        </div>
                    </div>
                </div>
            )}

            {/* i6 芭蕉扇：方向選擇 Overlay */}
            {isFanDirectionMode && (() => {
                const FAN_DIRECTIONS = [
                    { q: 1, r: -1, label: '↗', name: '東北' },
                    { q: 1, r: 0,  label: '→', name: '東' },
                    { q: 0, r: 1,  label: '↘', name: '東南' },
                    { q: -1, r: 1, label: '↙', name: '西南' },
                    { q: -1, r: 0, label: '←', name: '西' },
                    { q: 0, r: -1, label: '↖', name: '西北' },
                ];
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-orange-500/40 rounded-2xl p-5 w-72 shadow-2xl">
                            <div className="text-center mb-4">
                                <div className="text-2xl mb-1">🪭</div>
                                <div className="text-white font-black text-base">芭蕉扇</div>
                                <div className="text-slate-400 text-xs mt-1">選擇吹風方向，推走前方直線怪物 3 格</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {FAN_DIRECTIONS.map(dir => (
                                    <button
                                        key={dir.name}
                                        onClick={async () => {
                                            setIsFanDirectionMode(false);
                                            // 掃描方向 1~3 格，找第一隻怪物
                                            const monsters = (dbEntities ?? []).filter(e => e.type === 'monster' && e.is_active !== false);
                                            let targetMonster: any = null;
                                            for (let dist = 1; dist <= 3; dist++) {
                                                const checkQ = userData.CurrentQ + dir.q * dist;
                                                const checkR = userData.CurrentR + dir.r * dist;
                                                const found = monsters.find(e => e.q === checkQ && e.r === checkR);
                                                if (found) { targetMonster = found; break; }
                                            }
                                            if (!targetMonster) {
                                                onShowMessage('芭蕉扇：該方向射程內無怪物！', 'info');
                                                return;
                                            }
                                            // 計算推移 3 格後的落點（遇 impassable 或邊界則停前一格）
                                            let landQ = targetMonster.q;
                                            let landR = targetMonster.r;
                                            for (let step = 1; step <= 3; step++) {
                                                const nextQ = targetMonster.q + dir.q * step;
                                                const nextR = targetMonster.r + dir.r * step;
                                                const nextHex = fullGrid.find(h => h.q === nextQ && h.r === nextR);
                                                if (!nextHex || TERRAIN_TYPES[nextHex.terrainId ?? '']?.impassable) break;
                                                landQ = nextQ;
                                                landR = nextR;
                                            }
                                            const res = await pushMonsterByFan(userData.UserID, targetMonster.id, landQ, landR);
                                            if (res.success) {
                                                onShowMessage(`芭蕉扇！${targetMonster.name ?? '怪物'} 被吹退至 (${landQ}, ${landR})！`, 'success');
                                            } else {
                                                onShowMessage(res.error ?? '推移失敗', 'error');
                                            }
                                        }}
                                        className="py-3 rounded-xl bg-slate-800 hover:bg-orange-700/60 border border-white/10 text-white font-black text-lg transition-colors active:scale-95"
                                    >
                                        <div>{dir.label}</div>
                                        <div className="text-[10px] text-slate-400 font-normal">{dir.name}</div>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setIsFanDirectionMode(false)}
                                className="w-full py-2 rounded-xl bg-slate-800 text-slate-400 text-sm hover:text-white transition-colors"
                            >取消</button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
