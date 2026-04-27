# Quickstart: Critical Security & Stability Fixes

**Feature**: Critical Security & Stability Audit Remediation  
**Date**: April 25, 2026  
**Branch**: `001-critical-security-fixes`

---

## Prerequisites

- Node.js 18+ (check with `node --version`)
- pnpm (package manager)
- Access to Vercel project (for KV rate limiting)
- Supabase project with auth enabled

---

## Environment Setup

### 1. Required Environment Variables

Add to `.env.local`:

```bash
# Existing (should already be present)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# NEW: Cloudinary (move from hardcoded)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_UPLOAD_PRESET=your-upload-preset
CLOUDINARY_WEBHOOK_KEY=random-webhook-secret

# NEW: Rate Limiting (Vercel KV - REQUIRED, in-memory fallback non-functional on Vercel's stateless runtime)
# Alternative: Supabase rate_limits table if KV unavailable
KV_URL=redis://...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...

# NEW: Error Monitoring (optional but recommended)
# SENTRY_DSN=https://...
# NEXT_PUBLIC_SENTRY_DSN=https://...
```

### 2. Verify Environment

```bash
# Check all required env vars are set
pnpm exec tsx scripts/verify-env.ts
```

---

## Development Workflow

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run Type Check

```bash
pnpm run typecheck
```

### 3. Start Dev Server

```bash
pnpm run dev
```

The app will be available at `http://localhost:3000`

---

## Testing Security Fixes

### Manual Test Checklist

#### 1. Middleware Route Protection

```bash
# Test 1: Unauthenticated access to admin routes
curl -I http://localhost:3000/en/admin-dashboard
# Expected: 302 Redirect to /en/login

# Test 2: After login as admin, access admin routes
curl -I http://localhost:3000/en/admin-dashboard --cookie "supabase-auth-token=..."
# Expected: 200 OK
```

#### 2. Production Error Logging

```bash
# Simulate production environment
NODE_ENV=production pnpm run dev

# Trigger an error in the app (e.g., invalid API call)
# Expected: Error appears in console (was previously silent)
```

#### 3. AI Endpoint Protection

```bash
# Test without authentication
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'
# Expected: 401 Unauthorized

# Test with authentication (after 10 rapid requests)
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: supabase-auth-token=..." \
  -d '{"prompt": "test"}'
# 11th request Expected: 429 Too Many Requests
```

#### 4. Profile Input Validation

```bash
# Test XSS prevention
curl -X POST http://localhost:3000/api/profile \
  -H "Cookie: supabase-auth-token=..." \
  -F "avatarUrl=javascript:alert(1)"
# Expected: Validation error

# Test valid input
curl -X POST http://localhost:3000/api/profile \
  -H "Cookie: supabase-auth-token=..." \
  -F "website=https://example.com"
# Expected: Success
```

---

## Implementation Order

### Phase 1: Critical (Deploy Blocking)

1. **Create `src/middleware.ts`** - Activate route protection
   ```bash
   git add src/middleware.ts
   git commit -m "fix(security): activate Next.js middleware for route protection"
   ```

2. **Fix `src/lib/logger.ts`** - Enable production error logging
   ```bash
   git add src/lib/logger.ts
   git commit -m "fix(logging): remove isDev gate from error/warn logging"
   ```

3. **Fix `src/app/api/admin/drizzle-profiles/route.ts`** - Use getUser()
   ```bash
   git add src/app/api/admin/drizzle-profiles/route.ts
   git commit -m "fix(auth): replace getSession with getUser for server-side verification"
   ```

### Phase 2: High Priority

4. **Fix `src/lib/supabase.ts`** - Remove noOpLock
5. **Create validation schema** - Add ProfileSchema
6. **Fix `src/actions/profile.ts`** - Add input validation
7. **Protect AI endpoint** - Add auth + rate limiting
8. **Fix CSP headers** - Add nonce-based CSP

### Phase 3: Medium Priority

9. **Fix localStorage usage** - Migrate to sessionStorage
10. **Fix quiz timer** - Remove score from dependencies
11. **Fix useToast** - Migrate to sonner
12. **Fix Cloudinary** - Use env var

---

## Deployment

### 1. Pre-deploy Checklist

- [ ] All environment variables set in Vercel
- [ ] Type check passes: `pnpm run typecheck`
- [ ] Build succeeds: `pnpm run build`
- [ ] Manual tests pass (see Testing section)

### 2. Deploy to Vercel

```bash
# Deploy to preview
vercel --preview

# Verify preview deployment
# Run manual tests against preview URL

# Deploy to production
vercel --prod
```

### 3. Post-deploy Verification

```bash
# Test production error logging
# Trigger test error and verify it appears in Vercel logs/Sentry

# Test middleware protection
curl -I https://your-domain.com/en/admin-dashboard
# Expected: 302 redirect

# Verify CSP headers
curl -I https://your-domain.com
# Expected: Content-Security-Policy header present with nonce
```

---

## Rollback Plan

If issues occur in production:

```bash
# Rollback to previous deployment
vercel rollback

# Or redeploy previous commit
git checkout main
vercel --prod
```

---

## Troubleshooting

### Middleware Not Running

**Symptom**: Routes not protected

**Check**:
```bash
# Verify middleware.ts exists at correct path
ls -la src/middleware.ts

# Check matcher config
# Should match: /((?!api|_next|_vercel|.*\..*).*)
```

### Logger Still Silent in Production

**Symptom**: No errors in Vercel logs

**Check**:
```bash
# Verify isDev check removed from error() and warn()
grep -n "if (isDev)" src/lib/logger.ts
# Should only appear in info() and debug()
```

### Rate Limiting Not Working

**Symptom**: No 429 responses

**Check**:
```bash
# Verify AI endpoint has rate limit middleware
grep -n "rateLimit" src/app/api/ai/chat/route.ts

# Check Vercel KV is configured (or Supabase rate_limits table alternative is active)
```

### CSP Breaking Inline Scripts

**Symptom**: Console errors about script-src

**Fix**:
- Add nonce to inline scripts
- Or move scripts to external files

---

## Resources

- [Supabase SSR Auth Best Practices](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [CSP Nonce Implementation](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [Vercel KV Rate Limiting](https://vercel.com/docs/storage/vercel-kv)
- [Zod Validation Library](https://zod.dev/)

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review research.md for detailed analysis
3. Check data-model.md for validation rules
4. Review contracts/api.md for API specifications
