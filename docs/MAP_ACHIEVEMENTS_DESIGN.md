# 地圖成就設計文檔

> 此文件規劃地圖探索、戰鬥、寶箱、隊友合作、角色技能相關成就。
> 所有 hint 使用謎語形式，不直接說明解鎖條件。

---

## 成就總覽（40 個）

| 類別 | 數量 |
|------|------|
| 探索類 | 5 |
| 戰鬥類 | 13 |
| 寶箱/地圖類 | 8 |
| 隊友合作類 | 5 |
| 角色技能類（role-exclusive） | 9 |
| **合計** | **40** |

---

### 探索類（5 個）

| ID | 名稱 | 稀有度 | Icon | 謎語 Hint | 解鎖條件 |
|---|---|---|---|---|---|
| `hometown_guard` | 本心守護者 | Rare | 🏠 | `'越靠近本心，魔之所在，便是最需守護之地…'` | 在距離原點 ≤ 3 格處擊殺怪物 |
| `far_explorer` | 心魔腹地 | Rare | 🌑 | `'十步之外，地圖已與尋常不同…'` | 在距離原點 ≥ 10 且 ≤ 12 格處擊殺怪物 |
| `zone_all_six` | 六境行者 | Epic | 🧭 | `'心有六執，走遍方知本心之所在…'` | 在全部 6 個區域各擊殺至少 1 隻怪物 |
| `deep_wanderer` | 深淵勇士 | Rare | 🏔️ | `'離本心越遠，考驗越深，卻也越能照見自己…'` | 在距離原點 ≥ 13 格處擊殺怪物 |
| `hexes_100` | 千里長征 | Epic | 👣 | `'行路之量，非一日之功，亦非一戰可得…'` | 累計移動格數 ≥ 100 |

> **距離說明**：中心草原約距離 0–7，心魔區從距離 8 開始。`far_explorer`（10-12）為中階，`deep_wanderer`（≥13）接近地圖邊緣（怪物約 Lv 17），是真正「深入敵境」的挑戰。

---

### 戰鬥類（13 個）

| ID | 名稱 | 稀有度 | Icon | 謎語 Hint | 解鎖條件 |
|---|---|---|---|---|---|
| `first_blood` | 初戰告捷 | Common | ⚔️ | `'行路之上，第一個攔路者，往往是最重要的…'` | 累計擊殺 1 隻怪物 |
| `kills_10` | 初露鋒芒 | Common | 🗡️ | `'十次手起刀落後，始知何為無懼…'` | 累計擊殺 10 隻 |
| `kills_30` | 嶄露鋒芒 | Common | ⚔️ | `'三十，只是開始，真正的戰場在更深處…'` | 累計擊殺 30 隻 |
| `kills_50` | 心魔剋星 | Rare | 🔱 | `'半百之戰，戰的不是外魔，是內心的影…'` | 累計擊殺 50 隻 |
| `kills_100` | 降魔真人 | Epic | 🐉 | `'百戰歸來，魔已非魔，皆化修行…'` | 累計擊殺 100 隻 |
| `kills_200` | 魔滅如塵 | Legendary | 🌊 | `'兩百魔，兩百面鏡，你已不再懼怕其中的影…'` | 累計擊殺 200 隻 |
| `elite_slayer` | 勇挑強敵 | Rare | 👑 | `'精英之名，非因其強，乃因未遇真勇者…'` | 擊殺 1 隻精英怪 |
| `demon_slayer` | 斬妖除魔 | Epic | 💀 | `'最難降的不是妖，是遇妖時心中升起的懼…'` | 擊殺 1 隻魔王怪 |
| `perfect_victory` | 無傷通關 | Rare | ✨ | `'身無一傷，非因敵弱，乃因心定…'` | 以滿 HP（= MaxHP）贏得戰鬥 |
| `underdog` | 以弱勝強 | Epic | ⚡ | `'勝負非由數字而定，而由心之堅韌…'` | 怪物等級 ≥ 玩家等級 +5 的情況下贏得戰鬥 |
| `zone_specialist` | 一域宗師 | Rare | 🏯 | `'一地之魔，盡皆俯首，方知所謂擅長…'` | 在同一心魔區域累計擊殺 ≥ 20 隻 |
| `triple_kill_day` | 三戰連捷 | Rare | 🔥 | `'三敵盡掃，此日非虛度…'` | 在同一邏輯日擊殺 ≥ 3 隻怪物 |
| `comeback_win` | 置之死地 | Epic | 💪 | `'看似殘破的那一刻，往往藏著最後的翻轉…'` | 以 HP ≤ 30% MaxHP 進入戰鬥並贏得（`near_death` ≤10% 的前哨站） |

> `kills_30` 為 kills_10 與 kills_50 之間的橋接里程碑。`comeback_win`（≤30%）與 `near_death`（≤10%）形成梯度，後者歸在寶箱/地圖類。

---

### 寶箱/地圖類（8 個）

| ID | 名稱 | 稀有度 | Icon | 謎語 Hint | 解鎖條件 |
|---|---|---|---|---|---|
| `first_chest` | 緣遇珍寶 | Common | 📦 | `'路旁所遇，皆有緣，皆是禮…'` | 首次開啟寶箱 |
| `chests_10` | 尋寶行者 | Rare | 💰 | `'十次俯身，十次與命運的對話…'` | 累計開啟 10 個寶箱 |
| `chests_30` | 大尋寶家 | Rare | 💎 | `'三十次偶遇，早已非偶然…'` | 累計開啟 30 個寶箱 |
| `mimic_master` | 慧眼識偽 | Rare | 👁️ | `'藏於寶箱之中者，未必是寶，慧眼方辨…'` | 成功通過一次魅怪慧根檢定（Savvy + d20 ≥ 12） |
| `mimic_veteran` | 老手識偽 | Epic | 👁️ | `'五次面對欺騙，五次看穿，慧根已深植…'` | 成功通過 5 次魅怪慧根檢定（累計） |
| `golden_chest` | 金光寶氣 | Epic | 🌟 | `'百箱之中，藏著那道金光，等你發現…'` | 寶箱中獲得黃金骰子 |
| `fog_survivor` | 霧裡仍勇 | Rare | 🌫️ | `'霧，遮住了路，卻遮不住心中的意志…'` | 觸發迷霧陷阱後，在同一邏輯日成功擊殺怪物 |
| `near_death` | 一線之間 | Epic | 💔 | `'那最後一口氣，往往藏著最大的奇蹟…'` | HP ≤ 10% MaxHP 情況下贏得戰鬥 |

---

### 隊友合作類（5 個）

| ID | 名稱 | 稀有度 | Icon | 謎語 Hint | 解鎖條件 | 備註 |
|---|---|---|---|---|---|---|
| `team_fighter` | 並肩作戰 | Rare | 🤝 | `'並肩者，非必為師，有時只是同路之人…'` | 在任意隊友相鄰（≤1格）的情況下贏得戰鬥 | 任何角色均可解鎖（包括沙悟淨本人） |
| `shield_brother` | 同袍相護 | Rare | 🛡️ | `'身邊有人，背後無憂，勝利非一人之功…'` | 在**沙悟淨**隊友相鄰（≤1格）的情況下贏得戰鬥 | 沙悟淨本人無法解鎖；與 `team_fighter` 區別：指定需要沙悟淨在場 |
| `dice_benefactor` | 慷慨同行 | Rare | 🎲 | `'給予，從不讓自己變少…'` | 累計贈予隊友能量骰子 ≥ 5 次 | |
| `lucky_heist` | 得助而征 | Epic | 🍀 | `'有人拉了你一把，你方知路還沒有走完…'` | 接受隊友能量骰子贈予後，在同一邏輯日成功擊殺怪物 | |
| `healing_light` | 仁心普澤 | Rare | 💫 | `'一戰之後，光照四方，同行皆得庇護…'` | 以唐三藏身份，一場勝利後治癒 ≥ 2 位隊友 | roleExclusive: 唐三藏 |

---

### 角色技能類（9 個，全部 role-exclusive）

每角色各有 **2 個專屬成就**，設計如下：

| 角色 | 成就一：Streak 天賦 | 成就二：地圖特性 |
|------|------------------|--------------|
| 孫悟空 | `wukong_streak7` | `wukong_obsidian` |
| 豬八戒 | `bajie_streak7` | `bajie_digger` |
| 沙悟淨 | `wujing_streak7` | `wujing_guardian` |
| 白龍馬 | `horse_streak7` | `horse_traveler` |
| 唐三藏 | `monk_streak7` | `healing_light`（隊友合作類已列） |

#### Streak 天賦成就（5 個）

解鎖條件：以對應角色身份，在 **Streak ≥ 7**（天賦第二階啟動）的狀態下贏得一場戰鬥。

| ID | 名稱 | 稀有度 | Icon | 謎語 Hint | 角色 |
|---|---|---|---|---|---|
| `wukong_streak7` | 越戰越勇 | Epic | 🐒 | `'七日不輟，戰場上的你已非昨日之猴…'` | 孫悟空 |
| `bajie_streak7` | 福澤滿溢 | Epic | 🐷 | `'七日堅持，連戰場上的命運都向你微笑…'` | 豬八戒 |
| `wujing_streak7` | 銅壁鐵牆 | Epic | 🏺 | `'七日不倒，化身行走的屏障，魔難傷分毫…'` | 沙悟淨 |
| `horse_streak7` | 萬里馳騁 | Epic | 🐴 | `'七日如一，每步皆快，每步皆有力…'` | 白龍馬 |
| `monk_streak7` | 佛光普照 | Epic | 📿 | `'七日信念不息，光自然照破黑暗…'` | 唐三藏 |

#### 地圖特性成就（4 個）

各角色第 2 個專屬成就，綁定其獨特地圖能力，避免重複 Streak 機制：

| ID | 名稱 | 角色 | 稀有度 | Icon | 謎語 Hint | 解鎖條件 |
|---|---|---|---|---|---|---|
| `wukong_obsidian` | 穿石破壁 | 孫悟空 | Epic | 🗿 | `'這堵牆，只是為了試驗那個有心破它的人…'` | 以孫悟空身份，利用金箍棒穿越黑曜石阻擋移動 ≥ 3 次 |
| `bajie_digger` | 九齒掘寶 | 豬八戒 | Rare | ⛏️ | `'老豬的鼻子，天生就是為了找到寶貝的…'` | 以豬八戒身份，累計開啟 ≥ 15 個寶箱 |
| `wujing_guardian` | 守護神盾 | 沙悟淨 | Epic | 🛡️ | `'沙，看似無形，卻擋住了千萬道侵擾…'` | 以沙悟淨身份，在相鄰隊友的情況下累計贏得 5 場戰鬥 |
| `horse_traveler` | 萬里馳騁 | 白龍馬 | Epic | 🏇 | `'步步皆有意義，縱然無人計數，馬知…'` | 以白龍馬身份，累計移動格數 ≥ 150（日行千里天賦讓白龍馬比他人更快達成） |

---

## 實作需求摘要

### 新增 DB 欄位（CharacterStats）

```sql
ALTER TABLE "CharacterStats"
  -- 原設計（不變）
  ADD COLUMN IF NOT EXISTS "TotalKills"        INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "EliteKills"        INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "DemonKills"        INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "TotalChestsOpened" INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ZonesCleared"     JSONB  NOT NULL DEFAULT '[]'::jsonb,
  -- 新增
  ADD COLUMN IF NOT EXISTS "TotalHexesMoved"  INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ZoneKillCounts"   JSONB  NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "MimicSuccesses"   INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "DonatedDice"      INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ObsidianPassages" INT   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "GuardianWins"     INT   NOT NULL DEFAULT 0;
```

**欄位說明：**
- `TotalHexesMoved`：累計移動格數，供 `hexes_100`（一般）、`horse_traveler`（白龍馬）使用
- `ZoneKillCounts`：各區域擊殺數 JSON map，例如 `{"pride":5,"anger":22}`，供 `zone_specialist` 使用
- `MimicSuccesses`：魅怪慧根成功次數，供 `mimic_veteran` 使用
- `DonatedDice`：贈予隊友骰子次數，供 `dice_benefactor` 使用
- `ObsidianPassages`：孫悟空穿越黑曜石次數，供 `wukong_obsidian` 使用
- `GuardianWins`：沙悟淨相鄰隊友勝場，供 `wujing_guardian` 使用

> 原有說明：`shield_brother`、`healing_light`、`near_death`、`deep_wanderer`、5 個 Streak 成就均為純事件偵測，**不需要新欄位**。同理新增的事件型成就：`hometown_guard`、`far_explorer`、`perfect_victory`、`underdog`、`triple_kill_day`、`comeback_win`、`golden_chest`、`fog_survivor`、`team_fighter`、`lucky_heist` 亦無需新欄位。

### 需修改的檔案

| 檔案 | 修改內容 |
|---|---|
| `supabase/migrations/YYYYMMDD_map_achievements.sql` | 新建，ALTER TABLE 加 11 個欄位（5 原有 + 6 新增） |
| `types/index.ts` | CharacterStats interface 加 6 個新欄位 |
| `lib/achievements.ts` | 加 40 個地圖成就定義（本文件全部）|
| `app/actions/achievements.ts` | 加 `checkMapAchievements(userId)` + `unlockSingleAchievement(userId, id)` |
| `app/actions/combat.ts` | 勝利後：更新計數器（TotalKills、ZoneKillCounts、GuardianWins）+ 偵測事件型成就 |
| `app/actions/map.ts` | 開箱後：更新 TotalChestsOpened、MimicSuccesses；偵測 golden_chest、fog_survivor；更新 TotalHexesMoved |
| `app/actions/team.ts` | 更新 DonatedDice；偵測 lucky_heist（骰子贈予 + 同日擊殺） |
| `app/page.tsx`（地圖移動邏輯） | 孫悟空穿越黑曜石時更新 ObsidianPassages |

### 區域字元對應表（monsterData.zone）

| zone char | zone ID |
|---|---|
| 慢 | pride |
| 疑 | doubt |
| 嗔 | anger |
| 貪 | greed |
| 痴 | delusion |
| 亂 | chaos |

---

*最後更新：2026-04-14*
