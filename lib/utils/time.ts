import { differenceInCalendarWeeks, startOfYear, addWeeks, startOfWeek } from 'date-fns';
import { TOPIC_PHASES } from '@/lib/constants';

/**
 * 取得邏輯日期字串 (YYYY-MM-DD)
 * 若在中午 12:00 前，視為前一天的日期
 */
export const getLogicalDateStr = (dateInput?: Date | string): string => {
    const date = dateInput ? new Date(dateInput) : new Date();
    // 使用台灣時區 (UTC+8) 判斷小時，避免伺服器時區造成誤判
    const twParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const get = (type: string) => twParts.find(p => p.type === type)!.value;
    const hours = parseInt(get('hour'), 10);
    let y = parseInt(get('year'), 10);
    let m = parseInt(get('month'), 10);
    let day = parseInt(get('day'), 10);
    if (hours < 12) {
        const d = new Date(y, m - 1, day);
        d.setDate(d.getDate() - 1);
        y = d.getFullYear();
        m = d.getMonth() + 1;
        day = d.getDate();
    }
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * 取得本週一 00:00:00 的時間
 */
export const getWeeklyMonday = (date: Date = new Date()): Date => {
    const d = new Date(date);
    const day = d.getDay() || 7; // Convert Sunday (0) to 7
    d.setDate(d.getDate() - (day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
};

/**
 * 取得當前雙週挑戰主題親證階段
 * 根據 TOPIC_PHASES 中的日期範圍自動比對
 */
export const getCurrentTopicPhase = (): typeof TOPIC_PHASES[number] | null => {
    const now = new Date();
    return TOPIC_PHASES.find(p => now >= new Date(p.start) && now <= new Date(p.end)) ?? null;
};

/**
 * 取得雙週主題週期起始日 (BiWeeklyStart)
 * 每年奇數週的週一 00:00:00 作為一次起始
 */
export const getBiWeeklyStart = (date: Date = new Date()): Date => {
    const monday = getWeeklyMonday(date);
    const firstDayOfYear = startOfYear(monday);

    // 計算當前週一是該年度的第幾週 (相對於該年第一天的週數)
    const currentWeek = differenceInCalendarWeeks(monday, firstDayOfYear, { weekStartsOn: 1 }) + 1;

    if (currentWeek % 2 !== 0) {
        // 奇數週：當前週一即為起始
        return monday;
    } else {
        // 偶數週：往前推一週的週一
        const prevWeekMonday = new Date(monday);
        prevWeekMonday.setDate(prevWeekMonday.getDate() - 7);
        return prevWeekMonday;
    }
};
