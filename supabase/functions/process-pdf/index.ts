import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { handleProcessPdf } from "./handler.ts";

// Thin production entry: no import.meta.main dependency (Supabase Edge
// Runtime does not guarantee it). All logic lives in handler.ts so tests can
// import the real handler without side effects.
serve(handleProcessPdf);
