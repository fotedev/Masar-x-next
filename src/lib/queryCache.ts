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
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Set data in cache with a TTL (in milliseconds)
     */
    set<T>(key: string, data: T, ttlMs: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
        });
    }

    /**
     * Invalidate a specific cache key
     */
    invalidate(key: string): void {
        this.cache.delete(key);
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
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear all cached data
     */
    invalidateAll(): void {
        this.cache.clear();
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
};

// Default TTL values (in milliseconds)
export const cacheTTL = {
    notifications: 30 * 1000,  // 30 seconds
    summaries: 60 * 1000,      // 1 minute
    news: 60 * 1000,           // 1 minute
    appeals: 60 * 1000,        // 1 minute
    profile: 5 * 60 * 1000,    // 5 minutes
    subjects: 60 * 60 * 1000,  // 1 hour
    videos: 60 * 1000,         // 1 minute
    files: 60 * 1000,          // 1 minute
};
