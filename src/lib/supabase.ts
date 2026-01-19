import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Initializing Supabase Client...");
console.log("URL:", supabaseUrl ? "Defined" : "Undefined");
console.log("Key:", supabaseAnonKey ? "Defined" : "Undefined");

export const supabase = createBrowserClient(
  supabaseUrl!,
  supabaseAnonKey!
)

// Re-export chatHelpers from the new location
export { chatHelpers } from './chatHelpers'
