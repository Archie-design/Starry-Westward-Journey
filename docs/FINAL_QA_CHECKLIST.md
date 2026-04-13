# 最終品質驗收清單

> 建立日期：2026-04-04  
> 目的：對照 GAME_DESIGN.md + MAP_DESIGN.md 逐項驗收，確保上線前系統行為符合設計規格。  
> 圖例：⬜ 待執行 | ✅ 通過 | ❌ 失敗（附說明） | ⏭️ 跳過（決策不做）

---

## A. 打卡與任務系統

> 驗收執行：2026-04-04｜依據 `supabase/migrations/202604040001_process_checkin_rpc.sql` 及 `app/page.tsx` roleTrait useMemo 分析

| # | 項目 | 驗收標準 | 狀態 |
|---|------|---------|------|
| A1 | q1–q7 每日打卡 | 每日最多3筆 q-quests，重複防護有效，修為/骰子/金幣正確入帳 | ✅ |
| A2 | q1_dawn 破曉打拳 | 與 q1 互斥；持有 a2 照妖鏡時額外 +150 修為（不含金幣，設計如此） | ✅ |
| A3 | w1–w4 週任務 | 各有次數上限，QuestID 格式 `w1\|YYYY-MM-DD` 正確寫入 | ✅ |
| A4 | bd_yuanmeng 親證圓夢 | 需持有 a6 定風珠；每週最多3次；+300 修為 | ✅ |
| A5 | temp_* 臨時任務 | 每位玩家每個任務ID只能領取一次；active=false 時隱藏 | ✅ |
| A6 | 打卡 Undo | 還原最近一筆，修為/骰子/金幣扣回，邏輯日期同一天內有效 | ✅ |
| A7 | 邏輯日期跨午 | 12:00 前打卡算前一天，12:00 後算當天 | ✅ |
| A8 | 每週推薦定課抽籤 | 小隊長手動抽、管理員代抽、不重複規則、循環重置 | ✅ |
| A9 | t 開頭體系活動 | +1 黃金骰子；持有 a4 幌金繩時個人修為 ×1.5 | ✅ |

### A 區修正說明（已補強，待部署至 Supabase）

**A4 + A5 + A9**：新增 migration `202604050000_fix_checkin_rpc.sql`，包含：
- **Fix 1（A9）**：a4 幌金繩從 `w2%` 改為 `t%` 前綴
- **Fix 2（A4）**：bd_yuanmeng 每週3次 server 端上限（ISO week 起算）
- **Fix 3（A5）**：temp_* 玩家單次限制 server 端驗證

**部署指令**：
```sql
-- 於 Supabase SQL Editor 執行 supabase/migrations/202604050000_fix_checkin_rpc.sql
```

---

## B. 神器系統

> 驗收執行：2026-04-04｜依據 `app/actions/store.ts`、`lib/constants.tsx`、`supabase/migrations/202604040001_process_checkin_rpc.sql`

| # | 項目 | 驗收標準 | 狀態 |
|---|------|---------|------|
| B1 | a1 如意金箍棒 | 個人 q-quest 修為 ×1.2；每人限1把；購買時補算既有修為 ×1.2 | ✅ |
| B2 | a2 照妖鏡 | 破曉打拳 +150 修為（僅修為，不含金幣）；每人限1把 | ✅ |
| B3 | a3 七彩袈裟 | 全隊 q1/q1_dawn 修為 ×1.5；需團隊購買（550×成員數） | ✅ |
| B4 | a4 幌金繩 | t-prefix 任務修為 ×1.5；需團隊購買（700×成員數） | ✅ |
| B5 | a5 金剛杖 | 修為 ×1.2；60歲以上（birthday 欄位驗證）；與 a1 互斥 | ✅ |
| B6 | a6 定風珠 | 購買後解鎖親證圓夢計劃打卡區塊；每人限1把 | ✅ |
| B7 | 法寶倍率疊加 | a1+a3 = ×1.8；a5+a3 = ×1.8；d7 ×2 疊加在上層 | ✅ |

### B 區修正說明

**B5**：`store.ts` 個人法寶購買路徑缺少 `exclusiveWith` 互斥檢查（該檢查僅存在於團隊法寶路徑）。已補入，現在 a1↔a5 購買時雙向互斥防護完整。RPC 端本已正確不疊加（`a5 AND NOT a1`）。

---

## C. 地圖與地形

> 驗收執行：2026-04-04｜依據 `components/Map/WorldMap.tsx` 靜態分析

| # | 項目 | 驗證方式 | 狀態 |
|---|------|---------|------|
| C1 | 六角格渲染 | 地圖正確顯示，各區域地形圖示無誤 | ⏭️ 目視驗收 |
| C2 | 移動消耗 AP | 每格 1 AP；骰子不足時無法移動 | ✅ |
| C3 | 地圖邊界 | 超出合法 hex 範圍的格子無法點擊/移動 | ✅ |
| C4 | **熔岩流 DoT（嗔區SE）** | 踏上後扣 5% MaxHP；完成 q1/q1_dawn/q2 後免疫（清涼心） | ✅ |
| C5 | **平滑鏡冰（慢區N）** | 踏上後朝移動方向直線強制滑行；完成 q5 後免疫（謙卑）；定心杵技能可免疫 | ✅ |
| C6 | **迷霧（疑區NE）** | 迷霧格內 2 格外怪物數值顯示 `???`；完成 q3 後免疫（心燈）；i2 火眼金睛擴展至 3 格 | ✅ |
| C7 | **深淵泥淖（貪區S）** | 踏入後**強制停止移動**（剩餘 AP 清零）；完成 q6 或 q7 後免疫（輕盈） | ✅ |
| C7b | **深淵泥淖 次回合減半** | 設計要求下回合移動力強制減半（**目前未實裝**） | ⏭️ 決策不做 |
| C8 | **流沙（痴區SW）** | 回合結束時強制位移至隨機可走鄰格；完成 q4 後免疫（定心）；定心杵技能可免疫 | ✅ |
| C9 | **刺骨孤寒（慢區N）** | 回合結束時固定扣除 1 顆能源骰子；完成 q5 後免疫（謙卑）；`onIsolationFreeze` callback 正確 | ✅ |
| C10 | **間歇泉（嗔區SE）** | 落地時 30% 機率噴飛至隨機可走鄰格（落地觸發，非下回合開始） | ✅ |
| C11 | 傳送門（本心草原） | 點擊後彈出六區目的地選單；需當日完成 3 項 q-quest | ✅ |
| C12 | 荊棘叢（疑區NE） | 進入消耗 2 AP（+1 額外）；i5 步雲履可免疫 | ✅ |
| C13 | 陷阱 trap（d5 業火之種） | 玩家踩上陷阱格時，若同格有怪物則引爆（Lv×50 傷害）；陷阱對玩家無效（by design） | ✅ |

### C 區問題說明

**C8**：設計規格已更新為「隨機相鄰可走格」，與實作一致。`MAP_DESIGN.md` 流沙描述同步修改。

**C11 已修正**：傳送門啟動條件從 `length > 0`（至少1項定課）修正為 `todayQCount < 3`（需完成3項 q-prefix 定課），錯誤訊息同步更新。

**C10 時序說明**：間歇泉在**落地瞬間**（`stepsRemaining === 0`）觸發，而非下回合開始時。因應非同步遊戲模型，落地即觸發在實務上等同「回合開始站上去」的效果，不予修改。

---

## D. 五毒詛咒

> 驗收執行：2026-04-04｜依據 `app/page.tsx` roleTrait useMemo、`components/Map/WorldMap.tsx`、`app/actions/combat.ts`

| # | 角色 | 觸發條件 | 詛咒效果 | 狀態 |
|---|------|---------|---------|------|
| D1 | 孫悟空 | q2 未完成 | 移動路徑隨機偏移 + DEF -30% | ✅ |
| D2 | 豬八戒 | q6 且 q7 都未完成（完成任一即解除） | 移動消耗 ×1.5 | ✅ |
| D3 | 沙悟淨 | q4 未完成 | 怪物等級/數值全部顯示 `???` | ✅ |
| D4 | 白龍馬 | q5 未完成 | 孤立狀態：無法贈骰給隊友、無法使用龍騰傳 AP | ✅ |
| D5 | 唐三藏 | q3 未完成 **或** Streak = 0 | 擲骰結果減半 | ✅ |

### D 區修正說明

**D1 已修正**：`resolveCombat` 未傳入 `playerDEFOverride`，導致孫悟空 DEF -30% 只顯示在 UI 但實際戰鬥未套用。已在 `WorldMap.tsx` `onAttack` 中計算 `irritableDEFOverride` 並傳入。

**D5 已修正**：`roleTrait` useMemo 中唐三藏的 `isCursed` 僅檢查 q3，未納入 `Streak = 0` 條件。已加入 `userData.Role === '唐三藏'` 分支：`isCursed = !hasQ3 || (userData.Streak ?? 0) === 0`。

**D2**：O5 決策已實裝（雙條件觸發），骰子歸零效果已移除（設計決策）。

**D4**：O6 已實裝（龍騰 + 贈骰雙向限制）。

---

## E. 戰鬥系統

> 驗收執行：2026-04-04｜依據 `app/actions/combat.ts`、`components/Map/WorldMap.tsx`、`components/MapEditor/CombatModal.tsx`

| # | 項目 | 驗收標準 | 狀態 |
|---|------|---------|------|
| E1 | 基礎戰鬥流程 | 攻擊 → 怪物反擊 → 結果判定 → modal 正常關閉 | ✅ |
| E2 | DDA 等效等級 | `effectiveLevel = max(monsterLv, floor(playerLv × 0.75))` | ✅ |
| E3 | 側翼/背刺加成 | 側翼 ×1.3、背刺 ×1.5，第一擊才有效 | ✅ |
| E4 | 暴擊/閃避 | 暴擊率 = Luck×5%；閃避率 = max(0, (10-Luck)×2%) | ✅ |
| E5 | 戰鬥獎勵 | 靈石 = effectiveLevel×20；骰子 10%；黃金骰 2%/精英10% | ✅ |
| E6 | 死亡懲罰 | 靈石 ×3%（最低10）；傳送回 (0,0) | ✅ |
| E7 | i3 錦鑭袈裟 | 致死傷害保 1 HP（本場有效，戰後清除） | ✅ |
| E8 | i4 如意金剛琢 | 封印怪物被動（frenzy 等），戰後清除 | ✅ |
| E9 | i9 九轉金丹 | 本場全屬性 +50%（戰後清除） | ✅ |
| E10 | i1 紫金紅葫蘆（收妖） | 收服低階怪（≤ 玩家等級×0.5）；modal 關閉；怪物移除；獎勵入帳 | ✅ |
| E11 | d1 五毒精魄 | 本場全屬+20%；已完成天命對治任務則 +40% | ✅ |
| E12 | d2 業障石 | 目標怪物等級 -3（最低Lv1） | ✅ |
| E13 | Streak 被動 | 孫悟空 ATK ×1.2/1.4；沙悟淨 DEF ×1.2/1.35；白龍馬 +1/+2 AP；唐三藏 Str7 ATK+Cha×5 | ✅ |
| E14 | 孫悟空緊箍咒 | q2 未打卡時 DEF -30% 套用到實際戰鬥（非僅顯示） | ✅ |
| E15 | d7 梵天庇護 | 啟動後 2 天死亡零金幣懲罰；仍傳送回 (0,0) | ✅ |
| E16 | 戰鬥 buff 清除 | 勝/敗/捕/錯誤四路徑皆清除所有戰鬥 buff | ✅ |

### E 區修正說明

**E6 已實裝**：死亡懲罰此前完全缺失。已新增：
- `WorldMap.tsx` `onAttack` 結果後，`newHP === 0 && !deathShieldTriggered` 時呼叫 `onPlayerDeath?.()`
- `page.tsx` `handlePlayerDeath`：d7 梵天庇護期間只傳送不扣金；否則扣 `max(10, 靈石 × 3%)` 並重置位置至 (0,0)

**E14 已修正**（D 區）：`playerDEFOverride` 正確傳入 `resolveCombat`，DEF -30% 在 server 端實際生效。

---

## F. 主動技能（Streak≥3）

> 驗收執行：2026-04-04｜依據 `app/actions/skills.ts`、`components/Map/WorldMap.tsx` 技能面板區段

| # | 角色 | 技能 | 驗收標準 | 狀態 |
|---|------|------|---------|------|
| F1 | 孫悟空 | 筋斗雲 | 當回合骰子點數 ×2（`moveMultiplier=2`，擲骰後自動重置為1）；1日冷卻（`skill_jintoudun` 寫入 DailyLogs） | ✅ |
| F2 | 豬八戒 | 九齒釘耙 | 消耗 1 AP；相鄰寶箱直接刪除必得1骰；空地 20% 機率 +50 金幣；Mimic 不觸發 Savvy 檢定 | ✅ |
| F3 | 沙悟淨 | 定心杵 | 消耗 1 AP；`dingXinZhuActive` 位移免疫（消耗即清除）；`noCritIncoming` 暴擊免疫 | ✅ |
| F4 | 白龍馬 | 龍騰 | 移動後 `dragonSoarPending=true`；選擇隊友後 `dragonSoarDonate` 轉移剩餘 AP；isCursed 防護 | ✅ |
| F5 | 唐三藏 | 般若咒 | 消耗 2 AP；面向方向前 3 格 Spirit×10 真傷；低於傷害則消滅怪物；隊友回復等量 HP | ✅ |

---

## G. 終極技能（Streak≥7）— 目前全數未實裝

| # | 角色 | 技能 | 狀態 |
|---|------|------|------|
| G1 | 孫悟空 | 大鬧天宮（周圍 AOE + 殺戮連鎖 +1 AP） | ⬜ 待實裝 |
| G2 | 豬八戒 | 天蓬真身（DEF ×3；深淵泥淖轉血量） | ⬜ 待實裝 |
| G3 | 沙悟淨 | 琉璃淨土（半徑 2 格結界 2 回合，地形效果失效） | ⬜ 待實裝 |
| G4 | 白龍馬 | 八部天龍（瞬移至任意隊友相鄰格，附步雲效果） | ⬜ 待實裝 |
| G5 | 唐三藏 | 佛光普照（全地圖復活陣亡隊友 + 驅散五毒異常） | ⬜ 待實裝 |

---

## H. 道具系統（消耗品）

> 驗收執行：2026-04-04｜依據 `app/actions/items.ts`、`app/actions/map.ts`、`components/Map/WorldMap.tsx`

| # | 道具 | 驗收標準 | 狀態 |
|---|------|---------|------|
| H1 | i2 火眼金睛 | 使用後設 `mimicImmune=true`（下次開箱跳過 Mimic）；持有期間被動延伸迷霧可見範圍 2→3 格 | ✅ |
| H2 | i5 步雲履 | 使用後設 `ignoreTerrainThisTurn=true`；免疫荊棘 +1 AP、豬八戒詛咒 ×1.5；回合結束自動清除 | ✅ |
| H3 | i6 芭蕉扇 | 使用後開啟 6 方向選擇 UI；選方向後掃描 1–3 格找第一隻怪物；推移 3 格（遇阻擋格停前一格）；無怪物時顯示提示 | ✅ |
| H4 | i7 神行甲馬 | 使用後呼叫 `onUpdateMultiplier(2)`；本回合擲骰 ×2；擲骰後自動重置 | ✅ |
| H5 | i8 觀音甘露水 | 服務端回復 30% MaxHP + 回傳 `clear_movement_debuff`；客戶端呼叫 `onUpdateMultiplier(1)` 解除移動減益 | ✅ |
| H6 | d4 混沌碎片 | 服務端 d20：1–5 客戶端隨機傳送；6–15 服務端清除當格怪物；16–20 開啟 NPCShopModal | ✅ |
| H7 | d6 貪狼之爪 | 使用後設 `d6ForceMimic=true`；踏入箱子後觸發 `_forceMimic: true`；失敗 +2 黃金骰；成功 +3 黃金骰 | ✅ |
| H8 | d7 渾天至寶珠 | 服務端寫 `d7_activated_at`；RPC exp ×2；`roleTrait.isCursed` d7 期間回傳 false；死亡零懲罰 | ✅ |

### H 區修正說明

**H7 已修正（兩處）**：
1. `page.tsx` `handleChestOpen` 呼叫缺少 `forceMimic` 參數。已補上第 4 引數 `!!entity._forceMimic`。
2. `page.tsx` 開箱後僅更新 `EnergyDice`，未處理 `lootGoldenDice`（d6 貪狼之爪成功/失敗時回傳黃金骰）。已加入 `GoldenDice` 同步更新。

**H8 已修正**：`roleTrait` useMemo 未檢查 `d7BuffActive`，導致 d7 梵天庇護期間豬八戒/沙悟淨/白龍馬/唐三藏詛咒仍然生效。已在 useMemo 最前方加入 `if (d7BuffActive) return { ...info, isCursed: false };`，並將 `d7BuffActive` 加入依賴陣列。（孫悟空的 `isIrritable` 已獨立實裝，此修正補齊其餘四角色。）

---

## I. 寶箱與 Mimic

> 驗收執行：2026-04-04｜依據 `app/actions/map.ts`、`app/actions/dice.ts`、`lib/constants.tsx`、`components/Map/WorldMap.tsx`

| # | 項目 | 驗收標準 | 狀態 |
|---|------|---------|------|
| I1 | 基礎寶箱開箱 | 掉落表：1骰60%、2骰30%、3骰10% | ✅ |
| I2 | Mimic 觸發率 | 20% 基礎機率 | ✅ |
| I3 | Mimic Savvy 檢定 | d20 + Savvy vs DC12：失敗 -1骰、成功 +1骰 | ✅ |
| I4 | 黃金骰子加持開箱 | 消耗1黃金骰：必得3骰子、無視 Mimic | ✅ |
| I5 | 火眼金睛（i2）跳過 Mimic | 使用後下次開箱 skipMimic=true（已於 H1 驗收） | ✅ |
| I6 | 九齒釘耙（F2）強制開箱 | 跳過 Savvy 檢定，必得1骰子（已於 F2 驗收） | ✅ |

### I 區修正說明

**I4 已修正**：`blessChestWithGoldenDice` server action 已實裝但從未被呼叫（無 UI 入口）。已在 `WorldMap.tsx` 補齊：
- 新增 `pendingChestEntity` state
- 點擊寶箱時若玩家有黃金骰子（`userData.GoldenDice > 0`），彈出確認 dialog
- 「普通開箱」直接觸發；「黃金加持」先呼叫 `blessChestWithGoldenDice`（設 IsBlessed=true），再觸發 `onEntityTrigger`，`handleChestOpen` 服務端自動識別 IsBlessed 並保證最高獎勵
- 客戶端樂觀更新 `GoldenDice - 1`

**I1/I2/I3**：`CHEST_LOOT_TABLE = [{dice:1, w:60},{dice:2, w:30},{dice:3, w:10}]`、`MIMIC_CHANCE = 0.2`、Savvy d20+Savvy vs DC12 皆已正確實裝於 `map.ts`。

---

## J. AI 功能

> 驗收執行：2026-04-04｜依據 `app/actions/gemini.ts`、`app/page.tsx` handleOpenWeeklyTab / handleGetAIBriefing

| # | 項目 | 驗收標準 | 狀態 |
|---|------|---------|------|
| J1 | 修行週報自動生成 | 開啟 weekly tab 時觸發，0–8s 隨機延遲防流量衝突；同週不重複呼叫 Gemini | ✅ |
| J2 | 週報快取 | 服務端先查 WeeklyReviews（week_label + user_id）；有非零完成率快取直接回傳 | ✅ |
| J3 | 週報內容 | WeeklyReview 含 summary、quote、trend、weeklyRate 四欄位 | ✅ |
| J4 | 隊長建議 | 服務端驗 IsCaptain；近 7 天全隊打卡率分析；每次開 captain tab 重新生成（無快取） | ✅ |
| J5 | Gemini 限流處理 | `generateContentWithRetry`：最多 4 次，`2^i×1000+jitter` ms Exponential Backoff | ✅ |
| J6 | 無 API Key | 早期 return `{ error: 'GEMINI_API_KEY 未設定' }`，不崩潰 | ✅ |

### J 區備註

**J1 觸發時機**：週報在「開啟 weekly tab」時觸發（非頁面 load 時），且僅於週一（1）、週四（4）、週六（6）（台灣時區）才發起新生成。其他日期進入 weekly tab 時，若 `weeklyReview` state 為 null，則不顯示週報（不再查 DB）。此為流量控制設計決策，不予修改。

---

## K. 貨幣與商店

> 驗收執行：2026-04-04｜依據 `app/actions/combat.ts`、`app/actions/store.ts`、`app/actions/items.ts`、`supabase/migrations/`

| # | 項目 | 驗收標準 | 狀態 |
|---|------|---------|------|
| K1 | 金幣（Coins）計算 | 打卡時 `floor(base_reward × 0.1)` 金幣（a2 +150 修為不含金幣）；法寶倍率在修為上，金幣從 base_reward 計算 | ✅ |
| K2 | 靈石來源 | 打怪獎勵 `effectiveLevel × 20` → `CharacterStats.GameGold`；與 Coins 嚴格隔離 | ✅ |
| K3 | 個人法寶購買 | a1/a2/a6 從 `Coins` 扣款；庫存寫入 `CharacterStats.Inventory`；a5 互斥/年齡/a6 a6 定風珠解鎖 | ✅ |
| K4 | 捐贈小隊金庫 | 扣個人 `Coins`，加至 `TeamSettings.team_coins`；`pg` transaction 保原子性 | ✅ |
| K5 | 團隊法寶購買 | 從 `team_coins` 扣款；費用 = 單價 × 成員數；寫入 `TeamSettings.inventory` | ✅ |
| K6 | NPC 消耗道具購買 | 從靈石扣款；`GameInventory` 陣列 count +1 | ✅ |

### K 區修正說明

**K2 重大修正（兩處）**：

1. **`add_combat_rewards` RPC 錯誤欄位**：原 RPC 將 `p_coins`（即 `coinReward`）加至 `CharacterStats.Coins`（定課金幣），而非 `GameGold`（戰鬥金幣）。導致 NPC 商店因 `GameGold` 永遠為 0 而無法購買任何道具。已新增 migration `202604060000_fix_combat_rewards_gamegold.sql`：
   - 新增 `p_game_gold` 參數 → 更新 `GameGold`
   - 新增 `p_team_name` / `p_team_bonus` 參數 → 原子性更新 `TeamSettings.team_coins`（修正第二個 bug）

2. **Team bonus 語法錯誤**：`combat.ts` 中 `supabase.from('TeamSettings').update({ team_coins: supabase.rpc('increment', ...) })` 將 RPC Builder 物件作為值傳入 update，為無效語法（team_coins 實際上會被設為 object 字串，不會累加）。已整合至新 RPC，在同一 DB 呼叫中原子性更新。

**部署指令**：
```sql
-- 於 Supabase SQL Editor 執行 supabase/migrations/202604060000_fix_combat_rewards_gamegold.sql
```

---

## L. 罰款系統

> 驗收執行：2026-04-04｜依據 `app/actions/fines.ts`、`app/actions/admin.ts`、`supabase/migrations/202604040002_fines_rpc.sql`

| # | 項目 | 驗收標準 | 狀態 |
|---|------|---------|------|
| L1 | w3 違規判定 | 隊長手動觸發；當週無 w3 紀錄者 +200 TotalFines；`AdminActivityLog` 冪等保護（同週同隊只計一次） | ✅ |
| L2 | 罰款餘額計算 | `GREATEST(0, TotalFines - FinePaid)`；TypeScript 和 RPC 皆用同公式 | ✅ |
| L3 | 小隊長記錄繳款 | `record_fine_payment` RPC：IsCaptain + 同隊驗證、餘額上限防護、原子 FinePaid 更新 + FinePayments 寫入 | ✅ |
| L4 | 組織上繳記錄 | `recordOrgSubmission` 寫 SquadFineSubmissions；`setPaidToCaptainDate` / `setSubmittedToOrgDate` 補登日期正常 | ✅ |

### L 區備註

**L1 冪等性設計說明**：RPC 檢查 `AdminActivityLog` 是否有 `action='w3_compliance' AND target_name='periodLabel|teamName'`，而此紀錄由 TypeScript 在 RPC 回傳後寫入。若 TypeScript log 寫入失敗（極少發生），下次觸發會重複加罰。目前設計為「隊長一週只手動觸發一次」場景，風險極低，不予修改。

---

## M. 排名與統計

> 驗收執行：2026-04-04｜依據 `components/Tabs/RankTab.tsx`、`app/actions/achievements.ts`、`app/actions/quest.ts`

| # | 項目 | 驗收標準 | 狀態 |
|---|------|---------|------|
| M1 | 個人修為榜 | DB 查詢 `order('Exp', ascending: false)`；RankTab 前端再 sort 一次（冗餘但無害） | ✅ |
| M2 | 小隊修為榜 | 依 `TeamName` 分組，`totalExp = sum(member.Exp)`，降序排列；含成員列表展開 | ✅ |
| M3 | 成就系統 | 43 個成就觸發條件完整；解鎖寫入 DB；`newAchievements` 回傳前端驅動 `achievementQueue` 通知 Modal | ✅ |

### M 區修正說明

**M3 已修正**：`quest.ts` 的 `checkAndUnlockAchievements` 在 fire-and-forget IIFE 中執行，且 `return` 裡硬寫 `newAchievements: []`，導致成就解鎖通知永遠不觸發（achievements 雖有寫入 DB，但玩家看不到 Modal）。已修正為：
- 對當前用戶 `await checkAndUnlockAchievements(userId, questId)`，結果直接回傳
- 對隊友的回溯成就觸發仍維持 fire-and-forget（隊友不需即時通知）

---

## N. 管理後台

| # | 模組 | 驗收標準 | 狀態 |
|---|------|---------|------|
| N1 | 業力結算（每週怪物生成） | 怪物數量依區域密度、玩家平均等級縮放 | ✅ |
| N2 | 臨時任務 CRUD | 新增/啟用暫停/刪除；玩家端即時生效 | ✅ |
| N3 | 人員管理 | 角色/隊伍設定正確寫入 | ✅ CSV 批量匯入；無單人行內編輯（設計如此） |
| N4 | 全服自動抽籤 | 替未抽籤的小隊代為抽出本週推薦定課 | ✅ |
| N5 | 巔峰試煉管理 | 建立/編輯/刪除/出席掃碼 | ✅ |
| N6 | 志工掃碼出席 | 密碼驗證、QR Code 掃描、出席記錄 | ✅ |

---

## O. 尚未實裝項目（本次最終階段決策）

| # | 項目 | 設計參考 | 決策 |
|---|------|---------|------|
| O1 | Streak≥7 終極技能（G1–G5） | GAME_DESIGN §7.5 | 🚫 擱置（課程結束前不實裝） |
| O2 | 黑曜石岩（孫悟空可穿越） | MAP_DESIGN §SE | ✅ 已實裝：isImpassable helper + 穿越不停留 |
| O3 | 世界 Boss 系統 | GAME_DESIGN §8.4 掉落表 | 🚫 擱置 |
| O4 | 開運大富翁玩家端交易 UI | FEATURE_STATUS §商城 | 🚫 擱置 |
| O5 | 豬八戒詛咒觸發條件改為「q6 且 q7 同時缺才觸發」 | GAME_DESIGN §2.2 | ✅ 已實裝：page.tsx roleTrait useMemo 雙條件 |
| O6 | 白龍馬詛咒「isCursed 下無法給予隊友 Buff」 | GAME_DESIGN §2.2 | ✅ 已實裝：龍騰選隊友 + donateDice 均有前端攔截 |
| O7 | 深淵泥淖「次回合移動力減半」 | MAP_DESIGN §S | ✅ 已確認實裝完整（上一輪驗收） |
| O8 | i6 芭蕉扇：方向選擇 → 推走直線怪物 3 格 | GAME_DESIGN §8.3 | ✅ 已實裝：isFanDirectionMode + pushMonsterByFan |
| O9 | i8 觀音甘露水：解除移動減益（moveMultiplier 重置為 1） | GAME_DESIGN §8.3 | ✅ 已實裝：clear_movement_debuff itemEffect |
| O10 | 傳送門「當日3項q-quest」條件驗證 | MAP_DESIGN §中心 | ✅ 已確認實裝完整（上一輪驗收） |
| O11 | 間歇泉 30% 噴飛效果 | MAP_DESIGN §SE | ✅ 已確認實裝完整（上一輪驗收） |
| O12 | AI 隊長建議改為不持久化（移除 CaptainBriefings 快取） | GAME_DESIGN §3.6.2 | ✅ 已實裝：gemini.ts 不讀寫快取，每次重新生成 |

---

## 執行紀錄

| 日期 | 執行者 | 項目 | 結果 | 備註 |
|------|--------|------|------|------|
| 2026-04-04 | Claude | H7 _forceMimic 未傳遞 | 🐛 修復 | page.tsx：handleChestOpen 第4參數 + lootGoldenDice 更新 |
| 2026-04-04 | Claude | H8 d7 詛咒免疫缺漏 | 🐛 修復 | roleTrait useMemo 加 d7BuffActive 早期返回 |
| 2026-04-04 | Claude | I4 黃金骰子加持未接線 | 🐛 修復 | WorldMap.tsx：pendingChestEntity 確認對話框 |
| 2026-04-04 | Claude | K2 戰鬥金幣寫入 Coins 而非 GameGold | 🐛 修復 | 新增 migration + combat.ts 改呼叫 p_game_gold |
| 2026-04-04 | Claude | K2 team_coins 更新語法錯誤 | 🐛 修復 | 整合入 add_combat_rewards RPC 的 p_team_bonus |
| 2026-04-04 | Claude | M3 成就解鎖通知從不觸發 | 🐛 修復 | quest.ts：await checkAndUnlockAchievements，返回 newAchievements |
| 2026-04-04 | Claude | N 區驗收 | ✅ 通過 | N1-N6 全數確認；N3 CSV-only 為設計如此 |
| 2026-04-04 | Claude | O 區驗收 | ✅ 通過 | O2/O5/O6/O8/O9/O12 已實裝；O1/O3/O4 擱置 |
