-- Enable RLS on all public tables that are exposed to PostgREST
-- and add permissive SELECT policy for anon role.
-- All writes go through service_role (server actions), which bypasses RLS.

DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'CharacterStats',
        'DailyLogs',
        'TeamSettings',
        'SystemSettings',
        'TopicHistory',
        'temporaryquests',
        'MandatoryQuestHistory',
        'CourseRegistrations',
        'CourseAttendance',
        'FinePayments',
        'SquadFineSubmissions',
        'Achievements',
        'Testimonies',
        'LineGroups'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY "anon_select_%s" ON public.%I FOR SELECT TO anon USING (true)',
            t, t
        );
    END LOOP;
END $$;

-- world_maps is unused but flagged — enable RLS without a SELECT policy
ALTER TABLE IF EXISTS public.world_maps ENABLE ROW LEVEL SECURITY;
