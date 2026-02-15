/**
 * Global type definitions for Node.js variables.
 * This file is a SCRIPT file (no export/import), so its declarations are global.
 */

/* eslint-disable no-var */

interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    [key: string]: string | undefined;
}

interface Process {
    env: ProcessEnv;
}

// These vars are now strictly global because this file has no import/export
declare var process: Process;
declare var require: NodeRequire;

interface NodeRequire {
    (id: string): unknown;
    resolve: (id: string) => string;
    cache: Record<string, unknown>;
    main: unknown;
}

// Polyfill NodeJS namespace for server-side compatibility if needed
declare namespace NodeJS {
    interface ProcessEnv {
        [key: string]: string | undefined;
        NEXT_PUBLIC_SUPABASE_URL: string;
        NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    }
}
