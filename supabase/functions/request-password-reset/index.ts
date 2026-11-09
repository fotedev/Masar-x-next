// @ts-nocheck: Deno runtime types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleRequestPasswordReset } from "./handler.ts";

// Thin production entry (same pattern as delete-avatar/process-pdf): all
// logic lives in handler.ts so handler-level tests can import the real
// handler without side effects. No import.meta.main dependency (Supabase
// Edge Runtime does not guarantee it).
serve(handleRequestPasswordReset);
