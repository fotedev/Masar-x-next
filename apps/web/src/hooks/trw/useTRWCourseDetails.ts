import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function useTRWCourseDetails(courseSlug: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['trw-course', courseSlug],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trw_courses')
        .select(`*,
          modules:trw_modules(*,
            materials:trw_materials(*)
          )`)
        .eq('slug', courseSlug)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!courseSlug,
  });
}