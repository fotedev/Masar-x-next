import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useTRWMembership() {
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
        .select(`
          *,
          plan:trw_plan_definitions(*)
        `)
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .or('expires_at.is.null,expires_at.gt.now()')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function useTRWCategories() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['trw-categories'],
    staleTime: 10 * 60 * 1000, // Categories change less frequently
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

export function useTRWCourses(categorySlug: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['trw-courses', categorySlug],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // First get category ID from slug
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

export function useTRWCourseDetails(courseSlug: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['trw-course', courseSlug],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trw_courses')
        .select(`
          *,
          modules:trw_modules(
            *,
            materials:trw_materials(*)
          )
        `)
        .eq('slug', courseSlug)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!courseSlug,
  });
}

export function useTRWProgress() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['trw-progress'],
    staleTime: 2 * 60 * 1000, // Progress can be slightly more fresh
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

export function useRedeemAccessCode() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('trw_redeem_access_code', {
        p_code: code,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trw-membership'] });
    },
  });
}
