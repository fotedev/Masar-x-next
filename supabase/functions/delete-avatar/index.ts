import { handleDeleteAvatar } from "./handler.ts";

// Thin production entry: no import.meta.main dependency (Supabase Edge
// Runtime does not guarantee it). All logic lives in handler.ts so tests can
// import the real handler without side effects.
Deno.serve(handleDeleteAvatar);
