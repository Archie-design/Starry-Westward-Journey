# 地圖成就設計文檔

> 此文件規劃地圖探索、戰鬥、寶箱、隊友合作、角色技能相關成就。
> 所有 hint 使用謎語形式，不直接說明解鎖條件。

---

## 成就總覽（19 個新成就）

### 探索類（2 個）

| ID | 名稱 | 稀有度 | Icon | 謎語 Hint | 解鎖條件 |
|---|---|---|---|---|---|
| `zone_all_six` | 六境行者 | Epic | 🧭 | `'心有六執，走遍方知本心之所在…'` | 在全部 6 個區域各擊殺至少 1 隻怪物 |
| `deep_wanderer` | 深淵勇士 | Rare | 🏔️ | `'離本心越遠，考驗越深，卻也越能照見自己…'` | 在距離原點 ≥ 13 格處擊殺怪物 |

> 距離說明：中心草原約距離 0–7，心魔區從距離 8 開始。13 格接近地圖邊緣（怪物約 Lv 17），是真正「深入敵境」的挑戰。

---

### 戰鬥類（6 個）

| ID | 名稱 | 稀有度 | Icon | 謎語 Hint | 解鎖條件 |
|---|---|---|---|---|---|
| `first_blood` | 初戰告捷 | Common | ⚔️ | `'行路之上，第一個攔路者，往往是最重要的…'` | 累計擊殺 1 隻怪物 |
| `kills_10` | 初露鋒芒 | Common | 🗡️ | `'十次手起刀落後，始知何為無懼…'` | 累計擊殺 10 隻 |
| `kills_50` | 心魔剋星 | Rare | 🔱 | `'半百之戰，戰的不是外魔，是內心的影…'` | 累計擊殺 50 隻 |
| `kills_100` | 降魔真人 | Epic | 🐉 | `'百戰歸來，魔已非魔，皆化修行…'` | 累計擊殺 100 隻 |
| `elite_slayer` | 勇挑強敵 | Rare | 👑 | `'精英之名，非因其強，乃因未遇真勇者…'` | 擊殺 1 隻精英怪 |
| `demon_slayer` | 斬妖除魔 | Epic | 💀 | `'最難降的不是妖，是遇妖時心中升起的懼…'` | 擊殺 1 隻魔王怪 |

---

### 寶箱/地圖類（4 個）

| ID | 名稱 | 稀有度 | Icon | 謎語 Hint | 解鎖條件 |
|---|---|---|---|---|---|
| `first_chest` | 緣遇珍寶 | Common | 📦 | `'路旁所遇，皆有緣，皆是禮…'` | 首次開啟寶箱 |
| `chests_10` | 尋寶行者 | Rare | 💰 | `'十次俯身，十次與命運的對話…'` | 累計開啟 10 個寶箱 |
| `mimic_master` | 慧眼識偽 | Rare | 👁️ | `'藏於寶箱之中者，未必是寶，慧眼方辨…'` | 成功通過一次魅怪慧根檢定（Savvy + d20 ≥ 12） |
| `near_death` | 一線之間 | Epic | 💔 | `'那最後一口氣，往往藏著最大的奇蹟…'` | HP ≤ 10% MaxHP 情況下贏得戰鬥 |

---

### 隊友合作類（2 個）

| ID | 名稱 | 稀有度 | Icon | 謎語 Hint | 解鎖條件 | 備註 |
|---|---|---|---|---|---|---|
| `shield_brother` | 同袍相護 | Rare | 🛡️ | `'身邊有人，背後無憂，勝利非一人之功…'` | 在沙悟淨隊友相鄰（≤1 格）的情況下贏得戰鬥 | 沙悟淨本人無法解鎖 |
| `healing_light` | 仁心普澤 | Rare | 💫 | `'一戰之後，光照四方，同行皆得庇護…'` | 以唐三藏身份，一場勝利後治癒 ≥ 2 位隊友 | roleExclusive: 唐三藏 |

---

### 角色技能類（5 個，全部 role-exclusive）

解鎖條件：以對應角色身份，在 **Streak ≥ 7**（天賦第二階啟動）的狀態下贏得一場戰鬥。

| ID | 名稱 | 稀有度 | Icon | 謎語 Hint | 角色 |
|---|---|---|---|---|---|
| `wukong_streak7` | 越戰越勇 | Epic | 🐒 | `'七日不輟，戰場上的你已非昨日之猴…'` | 孫悟空 |
| `bajie_streak7` | 福澤滿溢 | Epic | 🐷 | `'七日堅持，連戰場上的命運都向你微笑…'` | 豬八戒 |
| `wujing_streak7` | 銅壁鐵牆 | Epic | 🏺 | `'七日不倒，化身行走的屏障，魔難傷分毫…'` | 沙悟淨 |
| `horse_streak7` | 萬里馳騁 | Epic | 🐴 | `'七日如一，每步皆快，每步皆有力…'` | 白龍馬 |
| `monk_streak7` | 佛光普照 | Epic | 📿 | `'七日信念不息，光自然照破黑暗…'` | 唐三藏 |

---

## 實作需求摘要

### 新增 DB 欄位（CharacterStats）

```sql
ALTER TABLE "CharacterStats"
  ADD COLUMN IF NOT EXISTS "TotalKills"       INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "EliteKills"       INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "DemonKills"       INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "TotalChestsOpened" INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ZonesCleared"    JSONB NOT NULL DEFAULT '[]'::jsonb;
```

`ZonesCleared` 儲存已擊殺過怪物的區域 ID 陣列，例如 `["pride","anger","greed"]`。

> `shield_brother`、`healing_light`、`near_death`、`deep_wanderer`、5 個角色技能成就均為純事件偵測，**不需要新欄位**。

### 需修改的檔案

| 檔案 | 修改內容 |
|---|---|
| `supabase/migrations/YYYYMMDD_map_achievements.sql` | 新建，ALTER TABLE 加 5 個欄位 |
| `types/index.ts` | CharacterStats interface 加 5 個欄位 |
| `lib/achievements.ts` | 加 19 個新成就定義（含 roleExclusive） |
| `app/actions/achievements.ts` | 加 `checkMapAchievements(userId)` + `unlockSingleAchievement(userId, id)` |
| `app/actions/combat.ts` | 勝利後：更新計數器 + 偵測所有事件型成就 |
| `app/actions/map.ts` | 開箱後：更新 TotalChestsOpened + 偵測 mimic_master |

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

*最後更新：2026-04-13*
