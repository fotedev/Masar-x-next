/**
 * Simple in-memory cache with TTL support for Supabase queries
 * Used to reduce redundant API calls and improve perceived performance
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

class QueryCache {
    private cache: Map<string, CacheEntry<unknown>> = new Map();
    private static instance: QueryCache;

    private constructor() { }

    static getInstance(): QueryCache {
        if (!QueryCache.instance) {
            QueryCache.instance = new QueryCache();
        }
        return QueryCache.instance;
    }

    /**
     * Get cached data if it exists and hasn't expired
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;

        // Try local storage if not in memory
        if (!entry && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            try {
                const stored = localStorage.getItem(`cache_${key}`);
                if (stored) {
                    const parsed = JSON.parse(stored) as CacheEntry<T>;
                    const now = Date.now();
                    if (now - parsed.timestamp < parsed.ttl) {
                        // Restore to memory cache
                        this.cache.set(key, parsed);
                        return parsed.data;
                    } else {
                        localStorage.removeItem(`cache_${key}`);
                    }
                }
            } catch {
                // ignore
            }
        }

        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                localStorage.removeItem(`cache_${key}`);
            }
            return null;
        }

        return entry.data;
    }

    /**
     * Set data in cache with a TTL (in milliseconds)
     */
    set<T>(key: string, data: T, ttlMs: number): void {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
        };
        this.cache.set(key, entry);

        // Also persist to local storage for important keys
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
            } catch {
                // ignore
            }
        }
    }

    /**
     * Invalidate a specific cache key
     */
    invalidate(key: string): void {
        this.cache.delete(key);
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.removeItem(`cache_${key}`);
        }
    }

    /**
     * Alias for invalidate to match Map API
     */
    delete(key: string): void {
        this.invalidate(key);
    }

    /**
     * Invalidate all cache entries matching a prefix
     */
    invalidatePrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.invalidate(key);
            }
        }

        // Also check localStorage
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(`cache_${prefix}`)) {
                        localStorage.removeItem(key);
                    }
                }
            } catch {
                // ignore
            }
        }
    }

    /**
     * Clear all cached data
     */
    invalidateAll(): void {
        this.cache.clear();
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('cache_')) {
                        localStorage.removeItem(key);
                    }
                }
            } catch {
                // ignore
            }
        }
    }

    /**
     * Check if a key exists and is valid
     */
    has(key: string): boolean {
        return this.get(key) !== null;
    }
}

// Export singleton instance
export const queryCache = QueryCache.getInstance();

// Cache key generators for consistent naming
export const cacheKeys = {
    notifications: (userId: string) => `notifications_${userId}`,
    summaries: () => 'summaries_all',
    news: () => 'news_all',
    appeals: () => 'appeals_all',
    profile: (userId: string) => `profile_${userId}`,
    subjects: () => 'subjects_all',
    videos: () => 'videos_all',
    files: () => 'files_all',
    subjectLectures: (subject: string) => `lectures_${subject}`,
    subjectDetails: (subject: string) => `subject_details_${subject}`,
    settings: () => 'platform_settings',
    enrollments: (instructorId?: string) => instructorId ? `enrollments_inst_${instructorId}` : 'enrollments_all',
};

// Default TTL values (in milliseconds)
export const cacheTTL = {
    notifications: 5 * 60 * 1000,   // 5 minutes (was 30s)
    summaries: 60 * 60 * 1000,      // 1 hour (was 1m)
    news: 20 * 60 * 1000,           // 20 minutes (was 1h)
    appeals: 30 * 60 * 1000,        // 30 minutes (was 1m)
    profile: 2 * 60 * 60 * 1000,    // 2 hours (was 5m)
    subjects: 60 * 60 * 1000,       // 1 hour (was 48h)
    levels: 60 * 60 * 1000,         // 1 hour (new)
    videos: 60 * 60 * 1000,         // 1 hour (was 5m)
    files: 60 * 60 * 1000,          // 1 hour (was 5m)
    lectures: 20 * 60 * 1000,   // 20 minutes (was 2h)
    subjectDetails: 48 * 60 * 60 * 1000, // 48 hours
    quizzes: 60 * 60 * 1000,        // 1 hour
    settings: 24 * 60 * 60 * 1000,  // 24 hours (Platform settings change rarely)
    enrollments: 10 * 60 * 1000,    // 10 minutes
};
