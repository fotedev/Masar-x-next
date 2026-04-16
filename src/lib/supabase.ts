import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const noOpLock = async <T>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<T>,
): Promise<T> => {
  return await fn();
};

export const supabase = createBrowserClient(
  supabaseUrl!,
  supabaseAnonKey!,
  {
    auth: {
      lock: typeof window === 'undefined' ? undefined : noOpLock,
    },
  },
)

// Remove re-export to avoid circular dependency
// export { chatHelpers } from './chatHelpers'
