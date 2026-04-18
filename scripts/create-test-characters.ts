/**
 * create-test-characters.ts
 *
 * 建立五個 50 等測試角色（每種角色各一），供維運工程師測試使用。
 *
 * 使用方式：
 *   npx tsx scripts/create-test-characters.ts
 *
 * 若已存在同 UserID 的角色，會以 UPDATE 覆蓋其數值；不影響其他真實使用者。
 * 若要清除所有測試角色，執行：
 *   DELETE FROM "CharacterStats" WHERE "UserID" LIKE 'TEST_%';
 *   DELETE FROM "TeamSettings" WHERE "team_name" = '測試小組';
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ─── 計算方式 ────────────────────────────────────────────────────────────────
// calculateLevelFromExp() 的逆向：
// 升到 Lv.n+1 需要 n*5 + 480 exp
// Lv.50 所需總 exp = Σ(i=1..49) (i*5 + 480) = 5*(49*50/2) + 480*49 = 29 645
const LEVEL_50_EXP = 29_645;
const TEST_TEAM = '測試小組';
const TEST_SQUAD = '測試大隊';

interface TestChar {
  UserID: string;
  Name: string;
  Role: string;
  maxHP: number;
  personalInventory: string[]; // a1/a5 互斥，見下方說明
}

// HP 公式：baseHP + Physique(=50) * hpScale  （來自 ROLE_CURE_MAP）
// 孫悟空：1000 + 50*50 = 3500
// 豬八戒：1500 + 50*80 = 5500
// 沙悟淨：1200 + 50*60 = 4200
// 白龍馬：800  + 50*40 = 2800
// 唐三藏：500  + 50*20 = 1500
// UserID 末三碼設為純數字，配合登入頁「手機末三碼」欄位（inputMode=numeric）
const TEST_CHARS: TestChar[] = [
  { UserID: 'TEST_孫悟空_001', Name: '【測試】悟空',   Role: '孫悟空', maxHP: 3500, personalInventory: ['a1', 'a2', 'a6'] },
  { UserID: 'TEST_豬八戒_002', Name: '【測試】八戒',   Role: '豬八戒', maxHP: 5500, personalInventory: ['a1', 'a2', 'a6'] },
  { UserID: 'TEST_沙悟淨_003', Name: '【測試】悟淨',   Role: '沙悟淨', maxHP: 4200, personalInventory: ['a1', 'a2', 'a6'] },
  { UserID: 'TEST_白龍馬_004', Name: '【測試】白龍馬', Role: '白龍馬', maxHP: 2800, personalInventory: ['a1', 'a2', 'a6'] },
  { UserID: 'TEST_唐三藏_005', Name: '【測試】三藏',   Role: '唐三藏', maxHP: 1500, personalInventory: ['a5', 'a2', 'a6'] },
];

// 小隊共用道具（a3 七彩袈裟、a4 幌金繩 存在 TeamSettings.inventory）
const TEAM_INVENTORY = ['a3', 'a4'];

// 每人共用資源
const COMMON = {
  Level:      50,
  Exp:        LEVEL_50_EXP,
  Coins:      9999,      // 足以測試所有法寶購買
  GameGold:   9999,      // 足以測試所有遊戲道具
  EnergyDice: 99,        // 足以在地圖自由移動
  GoldenDice: 10,        // 測試金骰功能
  Streak:     7,         // 觸發連擊 tier2（需 ≥7）
  Spirit:     50,
  Physique:   50,
  Charisma:   50,
  Savvy:      50,
  Luck:       50,
  Potential:  50,
  CurrentQ:   0,         // 出生在本心草原
  CurrentR:   0,
  TotalFines: 0,
  FinePaid:   0,
  TotalKills: 20,        // 用於成就測試
  EliteKills: 5,
  DemonKills: 2,
  TotalChestsOpened: 10,
  TotalHexesMoved:   50,
  MimicSuccesses:    3,
  DonatedDice:       5,
};

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL 環境變數未設定，請確認 .env.local');

  const { Client } = require('pg');
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log('✅ 已連線至資料庫');

  try {
    await client.query('BEGIN');

    // ── 1. 建立 / 更新測試小隊 ──────────────────────────────────────────────
    await client.query(`
      INSERT INTO "TeamSettings" (team_name, team_coins, inventory)
      VALUES ($1, 99999, $2::jsonb)
      ON CONFLICT (team_name) DO UPDATE
        SET team_coins = EXCLUDED.team_coins,
            inventory  = EXCLUDED.inventory
    `, [TEST_TEAM, JSON.stringify(TEAM_INVENTORY)]);
    console.log(`✅ TeamSettings [${TEST_TEAM}] 已建立/更新`);

    // ── 2. 建立 / 更新每個角色 ─────────────────────────────────────────────
    for (const char of TEST_CHARS) {
      const gameInventory = [
        // 各一份遊戲道具供測試（i1~i10 各 2 個）
        ...['i1','i2','i3','i4','i5','i6','i7','i8','i9','i10'].map(id => ({ id, count: 2 })),
        // 怪物掉落道具 d1~d7 各 1 個
        ...['d1','d2','d3','d4','d5','d6','d7'].map(id => ({ id, count: 1 })),
      ];

      await client.query(`
        INSERT INTO "CharacterStats" (
          "UserID", "Name", "Role", "TeamName", "SquadName",
          "Level", "Exp",
          "Coins", "GameGold", "EnergyDice", "GoldenDice",
          "Spirit", "Physique", "Charisma", "Savvy", "Luck", "Potential",
          "Streak",
          "HP", "MaxHP",
          "CurrentQ", "CurrentR",
          "Inventory", "GameInventory",
          "TotalFines", "FinePaid",
          "IsGM",
          "TotalKills", "EliteKills", "DemonKills",
          "TotalChestsOpened", "TotalHexesMoved",
          "MimicSuccesses", "DonatedDice"
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17,
          $18,
          $19, $20,
          $21, $22,
          $23::jsonb, $24::jsonb,
          $25, $26,
          $27,
          $28, $29, $30,
          $31, $32,
          $33, $34
        )
        ON CONFLICT ("UserID") DO UPDATE SET
          "Name"              = EXCLUDED."Name",
          "Role"              = EXCLUDED."Role",
          "TeamName"          = EXCLUDED."TeamName",
          "SquadName"         = EXCLUDED."SquadName",
          "Level"             = EXCLUDED."Level",
          "Exp"               = EXCLUDED."Exp",
          "Coins"             = EXCLUDED."Coins",
          "GameGold"          = EXCLUDED."GameGold",
          "EnergyDice"        = EXCLUDED."EnergyDice",
          "GoldenDice"        = EXCLUDED."GoldenDice",
          "Spirit"            = EXCLUDED."Spirit",
          "Physique"          = EXCLUDED."Physique",
          "Charisma"          = EXCLUDED."Charisma",
          "Savvy"             = EXCLUDED."Savvy",
          "Luck"              = EXCLUDED."Luck",
          "Potential"         = EXCLUDED."Potential",
          "Streak"            = EXCLUDED."Streak",
          "HP"                = EXCLUDED."HP",
          "MaxHP"             = EXCLUDED."MaxHP",
          "CurrentQ"          = EXCLUDED."CurrentQ",
          "CurrentR"          = EXCLUDED."CurrentR",
          "Inventory"         = EXCLUDED."Inventory",
          "GameInventory"     = EXCLUDED."GameInventory",
          "TotalFines"        = EXCLUDED."TotalFines",
          "FinePaid"          = EXCLUDED."FinePaid",
          "IsGM"              = EXCLUDED."IsGM",
          "TotalKills"        = EXCLUDED."TotalKills",
          "EliteKills"        = EXCLUDED."EliteKills",
          "DemonKills"        = EXCLUDED."DemonKills",
          "TotalChestsOpened" = EXCLUDED."TotalChestsOpened",
          "TotalHexesMoved"   = EXCLUDED."TotalHexesMoved",
          "MimicSuccesses"    = EXCLUDED."MimicSuccesses",
          "DonatedDice"       = EXCLUDED."DonatedDice"
      `, [
        char.UserID, char.Name, char.Role, TEST_TEAM, TEST_SQUAD,
        COMMON.Level, COMMON.Exp,
        COMMON.Coins, COMMON.GameGold, COMMON.EnergyDice, COMMON.GoldenDice,
        COMMON.Spirit, COMMON.Physique, COMMON.Charisma, COMMON.Savvy, COMMON.Luck, COMMON.Potential,
        COMMON.Streak,
        char.maxHP, char.maxHP,
        COMMON.CurrentQ, COMMON.CurrentR,
        JSON.stringify(char.personalInventory), JSON.stringify(gameInventory),
        COMMON.TotalFines, COMMON.FinePaid,
        false, // IsGM — 登入後請透過 SQL 手動設定特定帳號為 GM，避免測試角色濫用管理員功能
        COMMON.TotalKills, COMMON.EliteKills, COMMON.DemonKills,
        COMMON.TotalChestsOpened, COMMON.TotalHexesMoved,
        COMMON.MimicSuccesses, COMMON.DonatedDice,
      ]);

      console.log(`  ✅ ${char.Name} (${char.UserID}) Lv.50 已建立/更新`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 所有測試角色建立完成！');
    printSummary();

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 發生錯誤，已回滾：', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

function printSummary() {
  console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    測試角色一覽                                   │
├────────────────┬────────────┬──────────┬────────────────────────┤
│ UserID         │ 角色       │ MaxHP    │ 個人法寶               │
├────────────────┼────────────┼──────────┼────────────────────────┤
│ TEST_孫悟空    │ 孫悟空     │ 3,500    │ a1 如意金箍棒/a2/a6    │
│ TEST_豬八戒    │ 豬八戒     │ 5,500    │ a1 如意金箍棒/a2/a6    │
│ TEST_沙悟淨    │ 沙悟淨     │ 4,200    │ a1 如意金箍棒/a2/a6    │
│ TEST_白龍馬    │ 白龍馬     │ 2,800    │ a1 如意金箍棒/a2/a6    │
│ TEST_唐三藏    │ 唐三藏     │ 1,500    │ a5 金剛杖/a2/a6        │
├────────────────┴────────────┴──────────┴────────────────────────┤
│ 小隊名稱：測試小組  │  大隊名稱：測試大隊                        │
│ 小隊法寶（TeamSettings.inventory）：a3 七彩袈裟、a4 幌金繩      │
├──────────────────────────────────────────────────────────────────┤
│ 共用資源：                                                        │
│   Level=50（Exp=29,645）  Coins=9,999  GameGold=9,999            │
│   EnergyDice=99  GoldenDice=10  Streak=7（觸發連擊 tier2）       │
│   六維屬性全 50   GameInventory i1-i10 各 2 個 + d1-d7 各 1 個  │
├──────────────────────────────────────────────────────────────────┤
│ 登入方式：在登入頁直接輸入 UserID（TEST_孫悟空 等），            │
│           不需要 LINE 綁定。                                      │
│                                                                   │
│ 若要設定 GM 權限，執行：                                         │
│   UPDATE "CharacterStats" SET "IsGM" = true                      │
│   WHERE "UserID" = 'TEST_孫悟空';                                │
│                                                                   │
│ 登入帳號（姓名 / 手機末三碼）：                                   │
│   【測試】悟空   / 001                                            │
│   【測試】八戒   / 002                                            │
│   【測試】悟淨   / 003                                            │
│   【測試】白龍馬 / 004                                            │
│   【測試】三藏   / 005                                            │
│                                                                   │
│ 清除所有測試資料：                                                │
│   DELETE FROM "CharacterStats" WHERE "UserID" LIKE 'TEST_%';     │
│   DELETE FROM "TeamSettings" WHERE team_name = '測試小組';        │
└──────────────────────────────────────────────────────────────────┘
`);
}

main();
