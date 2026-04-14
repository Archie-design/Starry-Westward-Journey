export interface AchievementDef {
    id: string;
    name: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    icon: string;
    hint: string;
    description: string;
    roleExclusive?: string;
}

export const ZONE_CHAR_TO_ID: Record<string, string> = {
    '慢': 'pride', '疑': 'doubt', '嗔': 'anger',
    '貪': 'greed', '痴': 'delusion', '亂': 'chaos',
};

export const RARITY_STYLE = {
    common:    { border: 'border-orange-700/50', glow: 'shadow-orange-900/40',  text: 'text-orange-400',  bg: 'bg-orange-950/30',  label: '常見' },
    rare:      { border: 'border-slate-400/50',  glow: 'shadow-slate-500/40',   text: 'text-slate-200',   bg: 'bg-slate-700/20',   label: '罕見' },
    epic:      { border: 'border-yellow-500/60', glow: 'shadow-yellow-600/50',  text: 'text-yellow-300',  bg: 'bg-yellow-950/30',  label: '稀有' },
    legendary: { border: 'border-purple-500/70', glow: 'shadow-purple-600/60',  text: 'text-purple-300',  bg: 'bg-purple-950/30',  label: '傳說' },
} as const;

export const ACHIEVEMENTS: AchievementDef[] = [
    // ── 一般定課成就（30）──────────────────────────────────────────────
    { id: 'first_step',        name: '千里之行',   rarity: 'common',    icon: '👣', hint: '萬事起於足下…',               description: '完成了人生第一個定課' },
    { id: 'full_day',          name: '圓滿一日',   rarity: 'common',    icon: '🌕', hint: '今日已盡，無悔矣',              description: '在同一邏輯日完成 3 個定課' },
    { id: 'streak_3',          name: '三日不輟',   rarity: 'common',    icon: '🔥', hint: '三天，是個開始…',               description: '連續 3 天完成打拳定課' },
    { id: 'dawn_boxer',        name: '破曉修士',   rarity: 'common',    icon: '🌅', hint: '清晨的微光有你的身影',           description: '累計破曉打拳 5 次' },
    { id: 'veg_pioneer',       name: '蓮台素客',   rarity: 'common',    icon: '🥬', hint: '一飲一啄，皆有定數…',           description: '累計海鮮素 20 次' },
    { id: 'early_sleeper',     name: '夜歸明月',   rarity: 'common',    icon: '🌙', hint: '子時前已入夢…',                 description: '累計子時入睡 20 次' },
    { id: 'weekly_caller',     name: '小天使之約', rarity: 'common',    icon: '📞', hint: '緣分自有定時…',                 description: '累計小天使通話 5 次' },
    { id: 'comeback',          name: '回頭是岸',   rarity: 'rare',      icon: '🔄', hint: '路雖繞，終能歸…',               description: '某項定課超過 7 天未做，今日重新完成' },
    { id: 'streak_7',          name: '七日精進',   rarity: 'rare',      icon: '⚡', hint: '七，是完整的數字…',             description: '連續 7 天完成打拳定課' },
    { id: 'full_week',         name: '圓滿五日',   rarity: 'rare',      icon: '🗓️', hint: '無一日荒廢…',                  description: '連續 5 天各完成至少 1 個定課' },
    { id: 'dawn_devotee',      name: '寅時武者',   rarity: 'rare',      icon: '🌄', hint: '天還未亮，你已…',               description: '累計破曉打拳 20 次' },
    { id: 'meditation_master', name: '定慧之境',   rarity: 'rare',      icon: '🧘', hint: '心靜方能見本性…',               description: '累計感恩冥想 30 次' },
    { id: 'dance_devotee',     name: '當下之身',   rarity: 'rare',      icon: '💃', hint: '舞動即是修行…',                 description: '累計當下之舞 30 次' },
    { id: 'role_cure_10',      name: '破執之路',   rarity: 'rare',      icon: '💊', hint: '心魔有名，方能破解…',           description: '累計完成解毒定課 10 次' },
    { id: 'w4_giver',          name: '傳愛使者',   rarity: 'rare',      icon: '💌', hint: '愛是唯一不減的資源…',           description: '累計傳愛任務 10 次' },
    { id: 'topic_devotee',     name: '主題探索者', rarity: 'rare',      icon: '🔍', hint: '每個主題都是一扇門…',           description: '累計主題親證 5 次' },
    { id: 'yuanmeng',          name: '圓夢行者',   rarity: 'rare',      icon: '🌟', hint: '夢想不是用想的…',               description: '累計親證圓夢 3 次' },
    { id: 'all_daily',         name: '七藝初探',   rarity: 'rare',      icon: '🎯', hint: '七種修行，缺一不可…',           description: '每項日課各完成過一次' },
    { id: 'temp_master',       name: '隨機應變',   rarity: 'rare',      icon: '🎲', hint: '世事難料，但你準備好了…',       description: '累計完成臨時任務 5 次' },
    { id: 'marathon',          name: '百日征途',   rarity: 'epic',      icon: '🏃', hint: '修行路上，計步者長',             description: '累計完成 100 個定課' },
    { id: 'mastery_q1',        name: '打拳宗師',   rarity: 'epic',      icon: '🥊', hint: '拳不離手，曲不離口…',           description: '累計打拳 50 次' },
    { id: 'phoenix',           name: '浴火重生',   rarity: 'epic',      icon: '🦅', hint: '塵封已久的修行，重新燃起…',     description: '某項定課超過 14 天未做，今日重新完成' },
    { id: 'streak_30',         name: '月之恆心',   rarity: 'epic',      icon: '🌕', hint: '月滿則虧，但在滿之前…',         description: '連續 30 天完成打拳定課' },
    { id: 'role_cure_50',      name: '執念消融',   rarity: 'epic',      icon: '🌊', hint: '重複，是最深的修行…',           description: '累計完成解毒定課 50 次' },
    { id: 'five_hundred',      name: '五百修為',   rarity: 'epic',      icon: '💎', hint: '路遙知馬力…',                   description: '累計完成 500 個定課' },
    { id: 'dawn_legend',       name: '破曉傳說',   rarity: 'epic',      icon: '🌠', hint: '日日破曉，心不曾眠…',           description: '累計破曉打拳 50 次' },
    { id: 'full_month',        name: '月圓無缺',   rarity: 'epic',      icon: '📅', hint: '一月之中，滴水不漏…',           description: '連續 20 天各完成至少 1 個定課' },
    { id: 'prodigal',          name: '置之死地',   rarity: 'legendary', icon: '♾️', hint: '有些事，你以為永遠不會再做了…', description: '某項定課超過 30 天未做，今日重新完成' },
    { id: 'omnipractice',      name: '無所不修',   rarity: 'legendary', icon: '🌈', hint: '修行無邊，卻有人走遍…',         description: '完成過所有類型定課（q1-q7、w1-w4、t、bd_yuanmeng）' },
    { id: 'eternal_dawn',      name: '永恆破曉',   rarity: 'legendary', icon: '☀️', hint: '傳說中有人，每日破曉…',         description: '連續 7 天完成破曉打拳' },
    // ── 團隊協作成就（3）─────────────────────────────────────────────
    { id: 'team_punch',        name: '同心齊拳',   rarity: 'rare',      icon: '🤜', hint: '獨行者快，眾行者遠…',           description: '與隊友在同一天都完成了打拳定課' },
    { id: 'team_perfect',      name: '眾志成城',   rarity: 'epic',      icon: '🏆', hint: '你的小隊創造了奇蹟…',           description: '小隊全員在同一天都有打卡記錄' },
    { id: 'team_streak',       name: '共修三日',   rarity: 'epic',      icon: '🤝', hint: '同行三天，心更近了…',           description: '與任一隊友連續 3 天同日完成打拳' },
    // ── 職業專屬成就（10）────────────────────────────────────────────
    { id: 'wukong_dawn',       name: '齊天武聖',   rarity: 'epic',      icon: '🐒', hint: '某位鬥戰勝佛的傳人…',           description: '身為孫悟空，累計破曉打拳 30 次',    roleExclusive: '孫悟空' },
    { id: 'wukong_spirit',     name: '火眼金睛',   rarity: 'rare',      icon: '👁️', hint: '神識洞明，萬象皆透…',           description: '神識屬性達到 20 點',                roleExclusive: '孫悟空' },
    { id: 'bajie_veg',         name: '齋戒持身',   rarity: 'epic',      icon: '🐷', hint: '老豬也有清靜之日…',             description: '身為豬八戒，累計海鮮素 30 次',      roleExclusive: '豬八戒' },
    { id: 'bajie_physique',    name: '根骨渾厚',   rarity: 'rare',      icon: '💪', hint: '力大無窮，從此而來…',           description: '根骨屬性達到 20 點',                roleExclusive: '豬八戒' },
    { id: 'wujing_chant',      name: '悟淨持念',   rarity: 'epic',      icon: '🏺', hint: '水中沙，心中定…',               description: '身為沙悟淨，累計嗯啊吽七次 30 次',  roleExclusive: '沙悟淨' },
    { id: 'wujing_savvy',      name: '慧根深種',   rarity: 'rare',      icon: '🌿', hint: '悟性如流水，無形無礙…',         description: '悟性屬性達到 20 點',                roleExclusive: '沙悟淨' },
    { id: 'horse_gratitude',   name: '五感圓融',   rarity: 'epic',      icon: '🐴', hint: '馬行千里，感恩相隨…',           description: '身為白龍馬，累計五感恩 30 次',      roleExclusive: '白龍馬' },
    { id: 'horse_charisma',    name: '魅力非凡',   rarity: 'rare',      icon: '✨', hint: '行者之魅，眾人傾心…',           description: '魅力屬性達到 20 點',                roleExclusive: '白龍馬' },
    { id: 'monk_dance',        name: '疑心盡消',   rarity: 'epic',      icon: '🧧', hint: '師父的心，終於放下…',           description: '身為唐三藏，累計當下之舞 30 次',    roleExclusive: '唐三藏' },
    { id: 'monk_streak',       name: '取經之心',   rarity: 'legendary', icon: '📿', hint: '十萬八千里，一步未停…',         description: '連續 14 天有完成任意定課',          roleExclusive: '唐三藏' },
];

// ── 地圖成就（40 個）─────────────────────────────────────────────────────────
export const MAP_ACHIEVEMENTS: AchievementDef[] = [
    // ── 探索類（5）────────────────────────────────────────────────────────
    { id: 'hometown_guard',  name: '本心守護者', rarity: 'rare',      icon: '🏠', hint: '越靠近本心，魔之所在，便是最需守護之地…',     description: '在距原點最近之地（≤3 格），擊殺了侵入本心的心魔' },
    { id: 'far_explorer',    name: '心魔腹地',   rarity: 'rare',      icon: '🌑', hint: '十步之外，地圖已與尋常不同…',                 description: '深入心魔腹地（距原點 10–12 格），擊殺怪物' },
    { id: 'zone_all_six',    name: '六境行者',   rarity: 'epic',      icon: '🧭', hint: '心有六執，走遍方知本心之所在…',               description: '在全部 6 個心魔區域各擊殺至少 1 隻怪物' },
    { id: 'deep_wanderer',   name: '深淵勇士',   rarity: 'rare',      icon: '🏔️', hint: '離本心越遠，考驗越深，卻也越能照見自己…',     description: '在距原點 13 格以上的深淵地帶擊殺怪物（怪物約 Lv17）' },
    { id: 'hexes_100',       name: '千里長征',   rarity: 'epic',      icon: '👣', hint: '行路之量，非一日之功，亦非一戰可得…',         description: '累計移動格數突破 100' },
    // ── 戰鬥類（13）──────────────────────────────────────────────────────
    { id: 'first_blood',     name: '初戰告捷',   rarity: 'common',    icon: '⚔️',  hint: '行路之上，第一個攔路者，往往是最重要的…',     description: '擊殺了第一隻心魔' },
    { id: 'kills_10',        name: '初露鋒芒',   rarity: 'common',    icon: '🗡️',  hint: '十次手起刀落後，始知何為無懼…',               description: '累計擊殺 10 隻心魔' },
    { id: 'kills_30',        name: '嶄露鋒芒',   rarity: 'common',    icon: '⚔️',  hint: '三十，只是開始，真正的戰場在更深處…',         description: '累計擊殺 30 隻心魔' },
    { id: 'kills_50',        name: '心魔剋星',   rarity: 'rare',      icon: '🔱',  hint: '半百之戰，戰的不是外魔，是內心的影…',         description: '累計擊殺 50 隻心魔' },
    { id: 'kills_100',       name: '降魔真人',   rarity: 'epic',      icon: '🐉',  hint: '百戰歸來，魔已非魔，皆化修行…',               description: '累計擊殺 100 隻心魔' },
    { id: 'kills_200',       name: '魔滅如塵',   rarity: 'legendary', icon: '🌊',  hint: '兩百魔，兩百面鏡，你已不再懼怕其中的影…',     description: '累計擊殺 200 隻心魔' },
    { id: 'elite_slayer',    name: '勇挑強敵',   rarity: 'rare',      icon: '👑',  hint: '精英之名，非因其強，乃因未遇真勇者…',         description: '擊殺了精英心魔' },
    { id: 'demon_slayer',    name: '斬妖除魔',   rarity: 'epic',      icon: '💀',  hint: '最難降的不是妖，是遇妖時心中升起的懼…',       description: '擊殺了魔王心魔' },
    { id: 'perfect_victory', name: '無傷通關',   rarity: 'rare',      icon: '✨',  hint: '身無一傷，非因敵弱，乃因心定…',               description: '以滿 HP 狀態進入戰鬥並獲勝' },
    { id: 'underdog',        name: '以弱勝強',   rarity: 'epic',      icon: '⚡',  hint: '勝負非由數字而定，而由心之堅韌…',             description: '在怪物等級比自己高 5 級以上的情況下獲勝' },
    { id: 'zone_specialist', name: '一域宗師',   rarity: 'rare',      icon: '🏯',  hint: '一地之魔，盡皆俯首，方知所謂擅長…',           description: '在同一心魔區域累計擊殺 20 隻以上' },
    { id: 'triple_kill_day', name: '三戰連捷',   rarity: 'rare',      icon: '🔥',  hint: '三敵盡掃，此日非虛度…',                       description: '在同一天擊殺 3 隻以上心魔' },
    { id: 'comeback_win',    name: '置之死地',   rarity: 'epic',      icon: '💪',  hint: '看似殘破的那一刻，往往藏著最後的翻轉…',       description: '以不足 30% HP 進入戰鬥，最終獲勝' },
    // ── 寶箱/地圖類（8）──────────────────────────────────────────────────
    { id: 'first_chest',     name: '緣遇珍寶',   rarity: 'common',    icon: '📦',  hint: '路旁所遇，皆有緣，皆是禮…',                   description: '首次開啟寶箱' },
    { id: 'chests_10',       name: '尋寶行者',   rarity: 'rare',      icon: '💰',  hint: '十次俯身，十次與命運的對話…',                 description: '累計開啟 10 個寶箱' },
    { id: 'chests_30',       name: '大尋寶家',   rarity: 'rare',      icon: '💎',  hint: '三十次偶遇，早已非偶然…',                     description: '累計開啟 30 個寶箱' },
    { id: 'mimic_master',    name: '慧眼識偽',   rarity: 'rare',      icon: '👁️',  hint: '藏於寶箱之中者，未必是寶，慧眼方辨…',         description: '成功通過一次魅怪慧根檢定' },
    { id: 'mimic_veteran',   name: '老手識偽',   rarity: 'epic',      icon: '👁️',  hint: '五次面對欺騙，五次看穿，慧根已深植…',         description: '累計成功通過 5 次魅怪慧根檢定' },
    { id: 'golden_chest',    name: '金光寶氣',   rarity: 'epic',      icon: '🌟',  hint: '百箱之中，藏著那道金光，等你發現…',           description: '在寶箱中獲得黃金骰子' },
    { id: 'fog_survivor',    name: '霧裡仍勇',   rarity: 'rare',      icon: '🌫️',  hint: '霧，遮住了路，卻遮不住心中的意志…',           description: '觸發迷霧陷阱後，在同一天成功擊殺怪物' },
    { id: 'near_death',      name: '一線之間',   rarity: 'epic',      icon: '💔',  hint: '那最後一口氣，往往藏著最大的奇蹟…',           description: '以不足 10% HP 進入戰鬥並獲勝' },
    // ── 隊友合作類（5）────────────────────────────────────────────────────
    { id: 'team_fighter',    name: '並肩作戰',   rarity: 'rare',      icon: '🤝',  hint: '並肩者，非必為師，有時只是同路之人…',         description: '在任意隊友相鄰（≤1格）的情況下贏得戰鬥' },
    { id: 'shield_brother',  name: '同袍相護',   rarity: 'rare',      icon: '🛡️',  hint: '身邊有人，背後無憂，勝利非一人之功…',         description: '在沙悟淨隊友相鄰（≤1格）的情況下贏得戰鬥' },
    { id: 'dice_benefactor', name: '慷慨同行',   rarity: 'rare',      icon: '🎲',  hint: '給予，從不讓自己變少…',                       description: '累計贈予隊友能量骰子 5 次以上' },
    { id: 'lucky_heist',     name: '得助而征',   rarity: 'epic',      icon: '🍀',  hint: '有人拉了你一把，你方知路還沒有走完…',         description: '接受隊友能量骰子贈予後，在同一天成功擊殺怪物' },
    { id: 'healing_light',   name: '仁心普澤',   rarity: 'rare',      icon: '💫',  hint: '一戰之後，光照四方，同行皆得庇護…',           description: '以唐三藏身份，一場勝利後治癒 2 位以上隊友', roleExclusive: '唐三藏' },
    // ── 角色技能類（9，全部 role-exclusive）──────────────────────────────
    { id: 'wukong_streak7',  name: '越戰越勇',   rarity: 'epic',      icon: '🐒',  hint: '七日不輟，戰場上的你已非昨日之猴…',           description: '以孫悟空身份，在連續打卡 7 天狀態下贏得戰鬥', roleExclusive: '孫悟空' },
    { id: 'bajie_streak7',   name: '福澤滿溢',   rarity: 'epic',      icon: '🐷',  hint: '七日堅持，連戰場上的命運都向你微笑…',         description: '以豬八戒身份，在連續打卡 7 天狀態下贏得戰鬥', roleExclusive: '豬八戒' },
    { id: 'wujing_streak7',  name: '銅壁鐵牆',   rarity: 'epic',      icon: '🏺',  hint: '七日不倒，化身行走的屏障，魔難傷分毫…',       description: '以沙悟淨身份，在連續打卡 7 天狀態下贏得戰鬥', roleExclusive: '沙悟淨' },
    { id: 'horse_streak7',   name: '日行千里',   rarity: 'epic',      icon: '🐴',  hint: '七日如一，每步皆快，每步皆有力…',             description: '以白龍馬身份，在連續打卡 7 天狀態下贏得戰鬥', roleExclusive: '白龍馬' },
    { id: 'monk_streak7',    name: '佛光普照',   rarity: 'epic',      icon: '📿',  hint: '七日信念不息，光自然照破黑暗…',               description: '以唐三藏身份，在連續打卡 7 天狀態下贏得戰鬥', roleExclusive: '唐三藏' },
    { id: 'wukong_obsidian', name: '穿石破壁',   rarity: 'epic',      icon: '🗿',  hint: '這堵牆，只是為了試驗那個有心破它的人…',       description: '以孫悟空身份，利用金箍棒穿越黑曜石 3 次以上', roleExclusive: '孫悟空' },
    { id: 'bajie_digger',    name: '九齒掘寶',   rarity: 'rare',      icon: '⛏️',  hint: '老豬的鼻子，天生就是為了找到寶貝的…',         description: '以豬八戒身份，累計開啟 15 個以上寶箱', roleExclusive: '豬八戒' },
    { id: 'wujing_guardian', name: '守護神盾',   rarity: 'epic',      icon: '🛡️',  hint: '沙，看似無形，卻擋住了千萬道侵擾…',           description: '以沙悟淨身份，在隊友相鄰的情況下累計贏得 5 場戰鬥', roleExclusive: '沙悟淨' },
    { id: 'horse_traveler',  name: '龍馬精神',   rarity: 'epic',      icon: '🏇',  hint: '步步皆有意義，縱然無人計數，馬知…',           description: '以白龍馬身份，累計移動格數突破 150', roleExclusive: '白龍馬' },
];

export const ACHIEVEMENT_MAP = new Map(
    [...ACHIEVEMENTS, ...MAP_ACHIEVEMENTS].map(a => [a.id, a])
);
export const TOTAL_ACHIEVEMENTS = ACHIEVEMENTS.length + MAP_ACHIEVEMENTS.length;
