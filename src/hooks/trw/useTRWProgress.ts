import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function useTRWProgress() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['trw-progress'],
    staleTime: 5 * 60 * 1000, // Standardized to 5 minutes
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('trw_user_progress')
        .select('material_id, completed_at')
        .eq('user_id', user.id);

      if (error) throw error;
      return data;
    },
  });
}