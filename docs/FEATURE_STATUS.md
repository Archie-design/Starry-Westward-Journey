# 系統功能實裝狀態總覽

> 最後更新：2026-04-03（本日補完：d1–d7 使用效果全數實裝；巔峰試煉大隊長出席掃碼；Admin PeakTrialScanPassword 設定）  
> 圖例：✅ 已完成 | ⚠️ 部分實裝 | ❌ 未實裝 | 🔒 設計待定

---

## 核心打卡系統

| 功能 | 狀態 | 說明 |
|------|------|------|
| 每日定課打卡 q1–q7 | ✅ | `app/actions/quest.ts`，含重複防護與 artifact 加成 |
| q1_dawn 破曉打拳 | ✅ | 與 q1 互斥，同日只能擇一 |
| 週任務 w1–w4 | ✅ | `w1|YYYY-MM-DD` 格式，`app/actions/w4.ts` |
| 雙週主題任務 t1 | ✅ | `t`-prefix 系統任務 |
| 親證圓夢計劃 bd_yuanmeng | ✅ | a6 定風珠解鎖，每週最多 3 次 |
| 臨時任務 temp_ | ✅ | 管理後台建立，`temporaryquests` 表 |
| 邏輯日期跨午計算 | ✅ | `getLogicalDateStr()` in `lib/utils/time.ts` |
| 打卡 Undo 功能 | ✅ | Server action，含 RLS 修復 |

---

## 神器系統

| 功能 | 狀態 | 說明 |
|------|------|------|
| a1 如意金箍棒（×1.2 exp） | ✅ | `ARTIFACTS_CONFIG` in `lib/constants.tsx` |
| a2 照妖鏡（q1_dawn +150 exp） | ✅ | |
| a3 七彩袈裟（q1/q1_dawn ×1.5 exp，團隊） | ✅ | |
| a4 幌金繩（t-prefix ×1.5 exp，團隊） | ✅ | |
| a5 金剛杖（×1.2 exp，與 a1 互斥） | ✅ | 長者免費 |
| a6 定風珠（解鎖親證圓夢計劃） | ✅ | |

---

## 地圖系統

| 功能 | 狀態 | 說明 |
|------|------|------|
| 六角格地圖渲染 | ✅ | `components/Map/WorldMap.tsx`，軸向座標系 |
| 玩家移動（能源骰子消耗） | ✅ | |
| 地形效果（沼澤/荊棘/傳送等） | ✅ | |
| 步雲履 i5 無視地形 | ✅ | `ignoreTerrainThisTurn` state，所有地形扣 AP 邏輯均已套用 |
| 芭蕉扇 i6 位置推移 | ✅ | 使用後隨機推移 ±1 格，透過 `onMoveCharacter` 更新位置 |
| 神行甲馬 i7 擲骰 ×2 | ✅ | 使用後 `onUpdateMultiplier(2)`，下次擲骰結果翻倍 |
| 寶箱開啟（Mimic 判定） | ✅ | `app/actions/map.ts` |
| 偽裝寶箱地形 | ✅ | `handleMimicTerrain()` |
| 黃金骰子開箱加持 IsBlessed | ✅ | `IsBlessed` DB 欄位 + `blessChestWithGoldenDice()` |
| 火眼金睛 i2 跳過 Mimic | ✅ | `mimicImmune` state → `_mimicImmune` entity flag → `handleChestOpen(skipMimic)` |
| 黑曜石岩破壞機制 | ❌ | 孫悟空技能，地形定義未建立 |

---

## 戰鬥系統

| 功能 | 狀態 | 說明 |
|------|------|------|
| 基礎戰鬥解算 | ✅ | `app/actions/combat.ts`，`resolveCombat()` |
| DDA 等效等級 | ✅ | `effectiveLevel = max(monsterLv, floor(playerLv × 0.75))` |
| 背刺/側翼加成 | ✅ | flankingMultiplier 1.3x/1.5x |
| 暴擊/閃避系統 | ✅ | Luck 屬性影響 |
| 怪物被動技觸發 | ✅ | frenzy 模式等 |
| 戰鬥獎勵（金幣/骰子/黃金骰） | ✅ | 精英 ×2，全域惡魔掉落 |
| 如意金剛琢 i4 封鎖被動 | ✅ | `sealMonsterPassive` state → `resolveCombat` param，戰後自動清除 |
| 紫金紅葫蘆 i1 收服低階怪 | ⚠️ | CombatModal `onCapture` 接口存在，items.ts effect 待完成 |
| 錦鑭袈裟 i3 死亡保護 | ✅ | `hasDeathShield` prop 已接通 |
| 九轉金丹 i9 全屬性 ×1.5 | ✅ | `statBuffMultiplier` prop 已接通 |
| i8 觀音甘露水（HP 回復） | ✅ | `items.ts` |
| i10 人參果（永久強化弱屬） | ✅ | `items.ts` |
| 怪物掉落物 d1–d7 | ✅ | combat.ts 掉落機率計算，Luck 加成 |
| 孫悟空緊箍咒（-30% DEF） | ✅ | q2 未打卡觸發，CombatModal prop |
| 連續打卡技能 Streak（被動） | ✅ | combat.ts + CombatModal 顯示 |
| 連續打卡技能 Streak（主動） | ✅ | 筋斗雲/九齒釘耙/定心杵/龍騰/般若咒 全數實裝；HUD 技能面板（Streak ≥ 3 解鎖） |
| 世界 Boss | ❌ | 設計文件有，程式碼無 |

---

## 怪物生成系統

| 功能 | 狀態 | 說明 |
|------|------|------|
| 每週業力結算生成怪物 | ✅ | `triggerWeeklySnapshot()` in `admin.ts` |
| 各區域 15% 覆蓋率（WorldState 對應） | ✅ | good=8%/normal=15%/bad=25% |
| 怪物等級隨玩家群體平均等級縮放 | ✅ | `levelBoost`/`maxMonsterLevel` |
| 精英怪（25% chance, Lv≥半數上限） | ✅ | |
| 批次 INSERT（unnest，防 timeout） | ✅ | |

---

## 道具系統（消耗品 靈石）

| 道具 | 狀態 | 說明 |
|------|------|------|
| 購買 / 庫存管理 | ✅ | `buyGameItem()` |
| i1 紫金紅葫蘆（收服） | ✅ | `onCapture` 回呼：消耗道具、清除怪物、給予金幣 |
| i2 火眼金睛（免 Mimic） | ✅ | 使用後下次開箱跳過 Mimic 擲骰 |
| i3 錦鑭袈裟（死亡保護） | ✅ | `hasDeathShield` prop → 致死傷害保 1 HP |
| i4 如意金剛琢（封鎖被動） | ✅ | `sealMonsterPassive` → 戰鬥中怪物 frenzy/passive 不觸發 |
| i5 步雲履（無視地形） | ✅ | `ignoreTerrainThisTurn` → 沼澤/荊棘地形懲罰略過 |
| i6 芭蕉扇（推移位置） | ✅ | 隨機推移 ±1 格，透過移動回呼更新座標 |
| i7 神行甲馬（骰子 ×2） | ✅ | `onUpdateMultiplier(2)` → 下次擲骰步數翻倍 |
| i8 觀音甘露水（HP 回復） | ✅ | |
| i9 九轉金丹（全屬 ×1.5） | ✅ | |
| i10 人參果（永久強化弱屬） | ✅ | |

---

## 掉落物系統（d-items）

| 道具 | 狀態 | 說明 |
|------|------|------|
| 掉落機率計算（依怪物類型） | ✅ | combat.ts，Luck 屬性加成 |
| d1 五毒精魄（全屬 +20%/+40%） | ✅ | 客戶端 `d1CombatBuff` state；天命任務完成 → ×1.4，否則 ×1.2 |
| d2 業障石（怪物 -3 等） | ✅ | `d2LevelDebuff=3` → `resolveCombat monsterLevelDebuff`；CombatModal 顯示標籤 |
| d3 心魔殘骸（+2 骰 + 掉落率） | ✅ | 服務端：EnergyDice+2；DemonDropBoostSeasonal+0.05（combat.ts 套用） |
| d4 混沌碎片（d20 隨機效果） | ✅ | 服務端 d20：1–5 傳送、6–15 清怪、16–20 開啟 NPCShopModal |
| d5 業火之種（地格陷阱） | ✅ | 服務端插入 type='trap' MapEntity（72hr TTL）；WorldMap 碰撞呼叫 `applyTrapDamage()` |
| d6 貪狼之爪（保證 Mimic 獎勵） | ✅ | `d6ForceMimic` → `handleChestOpen(forceMimic=true)`；失敗+2/成功+3 黃金骰 |
| d7 渾天至寶珠（全隊 2 天 Buff） | ✅ | 服務端寫 `d7_activated_at`；quest.ts exp×2；page.tsx 孫悟空緊箍咒免疫 |

---

## 角色技能系統

### 緊箍咒（五毒詛咒）
| 功能 | 狀態 |
|------|------|
| 孫悟空 q2 未打 → 緊箍咒 -30% DEF | ✅ |
| 路徑隨機偏移 | ✅ | WorldMap.tsx 第 684–693 行，isCursed 條件對應 q2 未完成 |

### Streak 連續打卡技能（被動化版）
| 角色 | Streak ≥ 3 | Streak ≥ 7 |
|------|-----------|-----------|
| 孫悟空 | ✅ ATK ×1.2 | ✅ ATK ×1.4 + 暴擊 +15% |
| 豬八戒 | ✅ Mimic 失敗不扣骰 | ✅ Savvy +5 |
| 沙悟淨 | ✅ DEF ×1.2 | ✅ DEF ×1.35 + 死亡免疫 |
| 白龍馬 | ✅ 戰鬥前 +1 AP | ✅ 戰鬥前 +2 AP |
| 唐三藏 | ✅ 戰後 HP +10% | ✅ ATK + Charisma×5 |

### 主動技能（Streak ≥ 3）
| 功能 | 狀態 | 說明 |
|------|------|------|
| 筋斗雲（孫悟空，骰子 ×2） | ✅ | 1 日冷卻，`recordSomersaultUsed()` + `onUpdateMultiplier(2)` |
| 九齒釘耙（豬八戒，強制開箱） | ✅ | 消耗 1 AP，`useNineToothRake()` |
| 定心杵（沙悟淨，位移+爆擊免疫） | ✅ | 消耗 1 AP，`dingXinZhuActive` + `noCritIncoming` state |
| 龍騰（白龍馬，AP 轉隊友） | ✅ | 移動後觸發，`dragonSoarDonate()` |
| 般若咒（唐三藏，線形 AOE+治癒） | ✅ | 消耗 2 AP，`usePrajnaMantra()`，面向方向前 3 格 |

### 主動技能（Streak ≥ 7，終極）
| 功能 | 狀態 |
|------|------|
| 大鬧天宮（孫悟空，AOE） | ❌ |
| 天蓬真身（豬八戒，DEF ×3） | ❌ |
| 琉璃淨土（沙悟淨，2 回合護盾） | ❌ |
| 八部天龍（白龍馬，傳送） | ❌ |
| 佛光普照（唐三藏，地圖全體復活） | ❌ |

---

## 巔峰試煉系統

| 功能 | 狀態 | 說明 |
|------|------|------|
| DB 表（PeakTrials/Registrations/Reviews） | ✅ | |
| Admin 管理 UI（建立/編輯/刪除/審核） | ✅ | `ReviewModule.tsx` 巔峰試煉子頁 |
| 玩家端報名 UI（PeakTrialTab） | ✅ | `components/Tabs/PeakTrialTab.tsx` |
| QR Code 報到 | ✅ | `react-qr-code`，掃描由大隊長操作 |
| 出席標記後端 | ✅ | `markPeakTrialAttendance()`；大隊長掃碼 UI 含密碼驗證、場次選擇、即時名單 |

---

## 傳愛分數系統（w4）

| 功能 | 狀態 |
|------|------|
| 玩家提交申請 | ✅ |
| 小隊長審核 | ✅ |
| 管理員終審 + 修為入帳 | ✅ |

---

## 課程系統

| 功能 | 狀態 |
|------|------|
| 課程報名（班別 B/C） | ✅ |
| QR Code 顯示 | ✅ |
| 志工掃碼出席 | ✅ |

---

## 商城系統

| 功能 | 狀態 |
|------|------|
| 神器購買（Coins） | ✅ |
| 消耗品購買（靈石，i1–i10） | ✅ |
| 開運大富翁 骰子買賣 | ⚠️ | 後端 MonopolySettings 可設定，前端交易 UI 未實裝 |

---

## 排行榜 / 統計

| 功能 | 狀態 |
|------|------|
| 修為榜（週/月/總） | ✅ |
| 六維屬性 + 罰金統計 | ✅ |
| 成就系統 | ✅ |

---

## 管理後台

| 模組 | 狀態 |
|------|------|
| 儀表板（活躍玩家/業力結算） | ✅ |
| 審核中心（傳愛/親證故事/巔峰試煉） | ✅ |
| 人員管理 | ✅ |
| 任務管理（臨時任務 CRUD） | ✅ |
| 課程管理 | ✅ |
| 開運大富翁設定 | ✅ |
| 參數管理（SystemSettings） | ✅ |
| 圖片庫 | ✅ |
| Log 紀錄 | ✅ |

---

## 待辦（優先順序）

1. ⚠️ 開運大富翁 玩家端交易 UI（後端設定已完成）
2. ❌ Streak ≥ 7 終極技能（大鬧天宮/天蓬真身/琉璃淨土/八部天龍/佛光普照）
3. ❌ 黑曜石岩破壞（孫悟空技能，地形定義未建立）
4. 🔒 世界 Boss 系統
