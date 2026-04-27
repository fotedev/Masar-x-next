interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  userId: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// AI Chat rate limit configuration
const AI_CHAT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,    // 1 minute window
  maxRequests: 10,         // 10 requests per window
  keyPrefix: 'rate_limit:ai_chat:',
};

// In-memory storage for rate limits (fallback for development)
// In production, this should use Redis/Vercel KV
const rateLimitStore = new Map<string, RateLimitEntry>();

function getRateLimitKey(config: RateLimitConfig, userId: string): string {
  return `${config.keyPrefix}${userId}`;
}

function checkRateLimit(config: RateLimitConfig, userId: string): RateLimitResult {
  const key = getRateLimitKey(config, userId);
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    // First request
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if window has expired
  if (now - entry.windowStart >= config.windowMs) {
    // Reset window
    rateLimitStore.set(key, {
      count: 1,
      windowStart: now,
      userId,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Window still active
  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.windowStart + config.windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.windowStart + config.windowMs,
      retryAfter,
    };
  }

  // Allow request and increment counter
  entry.count += 1;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.windowStart + config.windowMs,
  };
}

function recordRequest(config: RateLimitConfig, userId: string): void {
  const key = getRateLimitKey(config, userId);
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart >= config.windowMs) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      windowStart: now,
      userId,
    });
  } else {
    // Increment in current window
    entry.count += 1;
  }
}

export function checkAIChatRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(AI_CHAT_RATE_LIMIT, userId);
}

export function recordAIChatRequest(userId: string): void {
  recordRequest(AI_CHAT_RATE_LIMIT, userId);
}

export { AI_CHAT_RATE_LIMIT };
export type { RateLimitConfig, RateLimitEntry, RateLimitResult };
