import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function useTRWCourses(categorySlug: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['trw-courses', categorySlug],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: catData, error: catError } = await supabase
        .from('trw_categories')
        .select('id')
        .eq('slug', categorySlug)
        .single();

      if (catError) throw catError;

      const { data, error } = await supabase
        .from('trw_courses')
        .select('*')
        .eq('category_id', catData.id)
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!categorySlug,
  });
}