# LINE 機器人整合開發文件

> **版本**：v1.0 | **建立日期**：2026-03-17
> 本文為 LINE 機器人整合的開發規範與設計說明。

---

## 一、功能概覽

LINE 官方帳號機器人提供兩大核心功能：

| 功能 | 說明 |
|------|------|
| **關鍵字教學回覆** | 學員在群組輸入特定關鍵字，機器人即時回覆系統操作教學 |
| **格式偵測存檔** | 偵測符合特定格式的訊息（如親證故事），自動存入資料庫 |

---

## 二、架構設計

```
LINE Group 訊息
    ↓
LINE Platform（驗簽名 x-line-signature）
    ↓ POST /api/webhook/line
Vercel Serverless Function
    ↓
事件路由
    ├── #親證故事 格式 → parser.ts 解析 → 存 Testimonies 表 → 回覆確認
    └── 關鍵字命中    → keywords.ts 查詢 → Reply API 回覆教學
```

### 新增檔案結構

```
/app/api/webhook/line/
    └── route.ts                ← 主 Webhook Handler（POST only）

/lib/line/
    ├── client.ts               ← LINE SDK 客戶端初始化
    ├── keywords.ts             ← 關鍵字 → 教學回應對照表
    └── parser.ts               ← 格式偵測與訊息解析

/app/actions/testimony.ts       ← 存親證故事 Server Action

/supabase/migrations/
    └── XXXXXXX_line_bot.sql    ← LineGroups、Testimonies 資料表
```

---

## 三、環境變數

在 `.env.local` 新增以下欄位：

```env
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
```

### 取得方式

1. 前往 [LINE Developers Console](https://developers.line.biz/)
2. 建立 Provider → 建立 **Messaging API** Channel
3. Basic Settings → 複製 **Channel Secret**
4. Messaging API → 發行長期 **Channel Access Token**（不限期）

---

## 四、資料庫 Schema

### LineGroups（記錄機器人已加入的群組）

```sql
CREATE TABLE IF NOT EXISTS "LineGroups" (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id    TEXT UNIQUE NOT NULL,   -- LINE group ID (C...)
    group_name  TEXT,                   -- 群組名稱（從 join 事件取得）
    registered_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Testimonies（親證故事存檔）

```sql
CREATE TABLE IF NOT EXISTS "Testimonies" (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_group_id    TEXT,
    line_user_id     TEXT NOT NULL,
    display_name     TEXT,           -- LINE 顯示名稱
    parsed_name      TEXT,           -- 解析出的「姓名：」欄位
    parsed_date      DATE,           -- 解析出的「日期：」欄位
    parsed_category  TEXT,           -- 解析出的「類別：」欄位
    content          TEXT NOT NULL,  -- 解析出的「內容：」主體
    raw_message      TEXT NOT NULL,  -- 原始完整訊息（備份）
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 五、關鍵字教學系統

### 設計原則

- **純關鍵字比對**（不使用 NLP），降低維護成本
- **包含比對**（`text.includes(keyword)`），不需完全符合
- **無命中靜默**：非關鍵字訊息不回應，避免群組噪音
- 優先順序：格式偵測 > 關鍵字比對

### 關鍵字對照表

| 觸發關鍵字 | 回覆主題 |
|-----------|---------|
| `打卡`、`如何打卡`、`定課打卡` | 打卡操作步驟教學 |
| `定課`、`日課`、`修行定課` | 每日定課介紹（q1–q9、三項上限、破咒打卡） |
| `週任務`、`每週任務` | 週任務說明（w1–w4 內容與骰子獎勵） |
| `骰子`、`移動`、`地圖` | 地圖與骰子操作說明 |
| `法寶`、`神器` | 法寶系統介紹（a1–a6 效果與購買） |
| `金幣`、`貨幣`、`購買` | 三軌貨幣說明（金幣 / 靈石 / 骰子） |
| `五毒`、`詛咒`、`緊箍咒` | 五毒詛咒觸發條件與破解方式 |
| `角色`、`抽角色`、`五運` | 五角色能力列表 |
| `排行`、`榜單` | 引導至 App 排行榜 Tab |
| `幫助`、`說明`、`功能` | 列出所有可用關鍵字 |

---

## 六、親證故事格式

### 標準格式（管理者公告給學員）

```
#親證故事
姓名：王小明
日期：2026-06-01
類別：家庭
內容：
今天和家人一起做了三道菜，感受到了生命的溫暖...
```

### 觸發條件

訊息中包含 `#親證故事` 或 `#親證` 即觸發解析流程。

### 解析欄位

| 欄位 | 格式 | 必填 |
|------|------|------|
| 姓名 | `姓名：[文字]` | 否（無則記 null） |
| 日期 | `日期：YYYY-MM-DD` | 否 |
| 類別 | `類別：[家庭/健康/工作/人際]` | 否 |
| 內容 | `內容：\n[多行文字]` | **必填**，缺少則不存檔 |

### 回覆訊息

成功存檔：
> ✨ 親證故事已記錄！感謝您的分享，這份親證將永久留存在班級記錄中。

格式錯誤（有 `#親證` 但無內容）：
> ❗ 請確認訊息格式包含「內容：」欄位，故事才能被正確記錄哦！

---

## 七、Webhook 安全性

LINE 每次發送 Webhook 時，會在 Header 附上 `x-line-signature`（HMAC-SHA256 簽名）。
必須在處理任何事件前先驗證簽名，防止偽造請求。

```ts
import { validateSignature } from '@line/bot-sdk';
const isValid = validateSignature(rawBody, channelSecret, signature);
```

---

## 八、LINE Console 設定步驟

1. 登入 [LINE Developers Console](https://developers.line.biz/)
2. 建立 Provider（若尚無）
3. 建立 Channel → 選 **Messaging API**
4. Messaging API 設定頁：
   - Webhook URL：`https://your-domain.vercel.app/api/webhook/line`
   - 啟用 **Use webhook**
   - **停用** 自動回應訊息（Auto-reply messages）
   - **停用** 問候訊息（Greeting messages）
5. 將官方帳號加入各群組，無需給予管理員權限

---

## 九、驗證方式

1. LINE Developers Console → Messaging API → **Verify** 按鈕確認 Webhook 連線正常
2. 加入測試群組，發送各關鍵字確認回覆內容正確
3. 發送格式正確的 `#親證故事`，至 Supabase 確認 `Testimonies` 表有新記錄
4. 發送格式不完整的 `#親證`（無內容欄位），確認不存檔並回覆提示
5. 發送一般訊息，確認機器人不回應（靜默）
6. 機器人加入新群組時，確認 `LineGroups` 表有記錄

---

## 十、待確認事項（上線前）

- [ ] 親證故事的「類別」選項是否固定？（現為：家庭 / 健康 / 工作 / 人際）
- [ ] 各關鍵字的教學說明文字需逐條撰寫確認
- [ ] 是否需要群組白名單（僅允許特定群組使用機器人）？
- [ ] 是否需要定時推播（如每週一提醒打卡）？
- [ ] Testimonies 資料是否需要在 Admin 後台顯示？
