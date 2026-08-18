import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function useTRWMembership() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['trw-membership'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 30 * 60 * 1000,   // Keep in memory for 30 minutes
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('trw_memberships')
        .select(`*,
          plan:trw_plan_definitions(*)`)
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .or('expires_at.is.null,expires_at.gt.now()')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}