'use server';

import { createClient } from '@supabase/supabase-js';
import { getLogicalDateStr } from '@/lib/utils/time';
import { checkAndUnlockAchievements } from './achievements';

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function processCheckInTransaction(
    userId: string,
    questId: string,
    questTitle: string,
    questReward: number,
    questDice: number = 0
) {
    const supabase = getServiceClient();
    const logicalToday = getLogicalDateStr();

    const { data, error } = await supabase.rpc('process_checkin', {
        p_user_id:       userId,
        p_quest_id:      questId,
        p_quest_title:   questTitle,
        p_quest_reward:  questReward,
        p_quest_dice:    questDice,
        p_logical_today: logicalToday,
    });

    if (error) {
        return { success: false, error: error.message };
    }

    const result = data as {
        success:       boolean;
        error?:        string;
        rewardCapped?: boolean;
        user?:         any;
    };

    if (!result.success) {
        return { success: false, error: result.error };
    }

    // Background: achievement checks + retroactive team checks (fire and forget)
    (async () => {
        try {
            await checkAndUnlockAchievements(userId, questId);
        } catch (_) {}

        try {
            const teamName: string | null = result.user?.TeamName ?? null;
            const todayCalendar = new Date().toISOString().split('T')[0];

            if ((questId === 'q1' || questId === 'q1_dawn') && teamName) {
                // Trigger achievements for teammates who also punched today
                const { data: teammates } = await supabase
                    .from('CharacterStats')
                    .select('UserID')
                    .eq('TeamName', teamName)
                    .neq('UserID', userId);

                if (teammates && teammates.length > 0) {
                    const teammateIds = teammates.map((r: any) => r.UserID);
                    const { data: punchLogs } = await supabase
                        .from('DailyLogs')
                        .select('UserID')
                        .in('UserID', teammateIds)
                        .in('QuestID', ['q1', 'q1_dawn'])
                        .gte('Timestamp', todayCalendar);

                    const punchedIds = [...new Set((punchLogs ?? []).map((r: any) => r.UserID as string))];
                    for (const id of punchedIds) {
                        checkAndUnlockAchievements(id, questId).catch(() => {});
                    }
                }
            }

            if (teamName) {
                // If all team members checked in today, trigger achievements for everyone
                const { data: allMembers } = await supabase
                    .from('CharacterStats')
                    .select('UserID')
                    .eq('TeamName', teamName);

                if (allMembers && allMembers.length > 1) {
                    const allIds = allMembers.map((r: any) => r.UserID as string);
                    const { data: activeLogs } = await supabase
                        .from('DailyLogs')
                        .select('UserID')
                        .in('UserID', allIds)
                        .gte('Timestamp', todayCalendar);

                    const activeIds = new Set((activeLogs ?? []).map((r: any) => r.UserID as string));
                    if (allIds.every((id: string) => activeIds.has(id))) {
                        for (const id of allIds) {
                            if (id !== userId) checkAndUnlockAchievements(id, questId).catch(() => {});
                        }
                    }
                }
            }
        } catch (_) {}
    })();

    return {
        success:         true,
        rewardCapped:    result.rewardCapped ?? false,
        user:            result.user,
        newAchievements: [],
    };
}

export async function processUndoTransaction(
    userId: string,
    questId: string,
    questReward: number,
    questDice: number = 0
) {
    const supabase = getServiceClient();
    const logicalToday = getLogicalDateStr();

    const { data, error } = await supabase.rpc('process_undo', {
        p_user_id:       userId,
        p_quest_id:      questId,
        p_quest_reward:  questReward,
        p_quest_dice:    questDice,
        p_logical_today: logicalToday,
    });

    if (error) {
        return { success: false, error: error.message };
    }

    const result = data as {
        success: boolean;
        error?:  string;
        user?:   any;
    };

    if (!result.success) {
        return { success: false, error: result.error };
    }

    return { success: true, user: result.user };
}
