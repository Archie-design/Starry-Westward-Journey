# 大無限開運西遊 — 技術架構總覽

> 最後更新：2026-04-17

## 前端框架

| 技術 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 16.1.6 | App Router，全站框架 |
| **React** | 19.2.3 | UI 元件 |
| **TypeScript** | ^5 | 全專案型別安全 |
| **Tailwind CSS** | ^4 | 樣式系統（含 `@tailwindcss/postcss`） |

## 後端 / Server Actions

Next.js Server Actions（`app/actions/`）負責所有後端邏輯，**無獨立後端服務**。

| 模組 | 用途 |
|------|------|
| `quest.ts` | 每日打卡、exp 計算 |
| `store.ts` | 法寶購買、代幣轉帳 |
| `combat.ts` | 戰鬥結算 |
| `dice.ts` / `team.ts` | 骰子轉移 |
| `map.ts` | 地圖寶箱 |
| `admin.ts` | 週快照、怪物生成 |
| `gemini.ts` | AI 劇情生成 |
| `course.ts` | 課程報名 / 簽到 |
| `achievements.ts` | 成就解鎖 |
| `w4.ts` / `fines.ts` | 傳愛分數、罰款 |
| `testimony.ts` | 見證管理 |
| `skills.ts` | 技能系統 |
| `peakTrials.ts` / `peak_trial.ts` | 巔峰試煉 |

## 資料庫

| 技術 | 用途 |
|------|------|
| **Supabase** (PostgreSQL) | 主資料庫，含 RLS 安全規則 |
| **`@supabase/supabase-js`** ^2.95 | 客戶端 SDK，用於簡單讀寫 |
| **`pg` (node-postgres)** ^8.18 | 需要明確 transaction（BEGIN/COMMIT）的操作 |
| **Supabase RPC** | `add_combat_rewards`, `transfer_dice`, `transfer_golden_dice`, `global_dice_bonus` |

Schema 管理：`supabase/migrations/`（15+ migration 檔案）

### 主要資料表

| 資料表 | 用途 |
|--------|------|
| `CharacterStats` | 角色狀態、背包、代幣 |
| `DailyLogs` | 每日打卡紀錄 |
| `TeamSettings` | 隊伍設定、隊伍法寶 |
| `MapEntities` | 地圖實體（怪物、寶箱等） |
| `temporaryquests` | 臨時任務 |
| `MandatoryQuestHistory` | 強制任務歷史 |
| `CourseRegistrations` | 課程報名 |
| `CourseAttendance` | 課程出席 |
| `SystemSettings` | 全域系統設定 |

### 兩種資料庫存取模式

- **`lib/db.ts` → `pg`**：需要明確 transaction 的操作（`quest.ts`, `store.ts`）
- **`@supabase/supabase-js`**：一般讀寫操作（`combat.ts`, `items.ts`, `dice.ts`, `team.ts` 等）

## 外部服務 / API

| 服務 | 套件 | 用途 |
|------|------|------|
| **Google Gemini** | `@google/genai` ^1.43 | AI 動態劇情（gemini-2.5-flash） |
| **LINE Bot** | `@line/bot-sdk` ^10.6 | LINE Webhook 推播通知 |
| **Google APIs** | `googleapis` ^171 | Google 登入 / 試算表整合 |
| **Vercel Analytics** | `@vercel/analytics` ^2 | 流量分析 |

## UI 工具庫

| 套件 | 用途 |
|------|------|
| **lucide-react** | 圖示系統 |
| **react-qr-code** | QR Code 顯示（學員報到） |
| **html5-qrcode** | QR Code 掃描（志工掃碼） |
| **date-fns** | 日期計算（含邏輯日期轉換） |

## API Routes

| 路徑 | 用途 |
|------|------|
| `api/webhook/line` | LINE Bot Webhook |
| `api/cron/auto-draw` | 定時自動抽獎 |
| `api/cron/w3-fine` | 定時罰款計算 |
| `api/auth/line` | LINE 登入 OAuth |
| `api/testimony-card` | 見證卡片產生 |
| `api/admin` | 管理員 API |

## 部署平台

**Vercel**（Next.js 原生支援）

### 環境變數

| 變數 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名金鑰 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服務角色金鑰 |
| `DATABASE_URL` | PostgreSQL 直連字串 |
| `GEMINI_API_KEY` | Google Gemini API 金鑰 |

## 架構特點

- **單頁設計**：`app/page.tsx` 為核心狀態中心，所有 Tab（daily / weekly / stats / rank / captain / shop / commandant / achievements / course）均在同一頁渲染，不拆分路由
- **邏輯日期**：`getLogicalDateStr()`（`lib/utils/time.ts`）— 中午 12:00 前算作前一天
- **六角地圖**：Axial 座標系 `(Q, R)`，pointy-topped，七個區域（本心草原 + 六魔心）
- **貨幣分離**：Coins（打卡獲得）/ GameGold（戰鬥獲得）/ EnergyDice / GoldenDice，四種貨幣完全獨立
