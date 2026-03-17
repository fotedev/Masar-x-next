import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function useTRWCategories() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['trw-categories'],
    staleTime: 5 * 60 * 1000, // Standardized to 5 minutes
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trw_categories')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}