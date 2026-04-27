# Feature Specification: Critical Security & Stability Audit Remediation

**Feature Branch**: `001-critical-security-fixes`  
**Created**: April 25, 2026  
**Status**: Draft  
**Input**: Fix critical security vulnerabilities and stability issues identified in comprehensive codebase audit including: middleware activation failure, production error logging blackout, authentication bypass vulnerabilities, CSP misconfiguration allowing XSS, unvalidated input handling, PII caching in localStorage, and hardcoded credentials

---

## Overview

This feature addresses critical security vulnerabilities and stability issues identified in a comprehensive forensic audit of the Masar X Next.js application. The audit revealed P0 (deploy-blocking) issues including inactive middleware allowing unauthorized route access, production error blackout preventing observability, and authentication bypass vulnerabilities. This specification covers remediation of all critical and high-priority findings.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Route Protection (Priority: P1)

As an admin user, I want admin dashboard routes to be properly protected so that only authorized users can access administrative functions.

**Why this priority**: Without active middleware, admin routes are completely unprotected, allowing any user (or anonymous visitor) to access sensitive administrative functions. This is a deploy-blocking security vulnerability.

**Independent Test**: Navigate directly to `/admin-dashboard` without authentication. The system should redirect to login page. After authenticating as admin, access should be granted.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user, **When** they attempt to access `/admin-dashboard`, **Then** they are redirected to the login page
2. **Given** an authenticated non-admin user, **When** they attempt to access `/admin-dashboard`, **Then** they receive a 403 forbidden error
3. **Given** an authenticated admin user, **When** they access `/admin-dashboard`, **Then** they can view and use admin functions

---

### User Story 2 - Production Error Observability (Priority: P1)

As a system administrator, I want production errors to be logged and reported so that I can detect and respond to issues promptly.

**Why this priority**: Current production environment silently discards all errors (`isDev` gate in logger), creating a blind spot where critical failures go undetected. This prevents operational response to production issues.

**Independent Test**: Trigger an error in production environment. Error should appear in monitoring dashboard (Sentry/Vercel) within seconds, not be silently discarded.

**Acceptance Scenarios**:

1. **Given** the application is running in production, **When** an error occurs, **Then** the error is logged and sent to the monitoring service
2. **Given** a warning condition occurs, **When** the logger.warn() is called, **Then** the warning appears in production logs
3. **Given** an admin accesses error logs, **When** they view the monitoring dashboard, **Then** they can see recent errors with stack traces

---

### User Story 3 - Secure Authentication Flow (Priority: P1)

As a user, I want my authentication to be secure so that my account cannot be accessed by attackers using forged credentials.

**Why this priority**: The current API routes use `getSession()` which reads unverified JWT cookies, allowing authentication bypass with forged tokens. This is a critical security vulnerability.

**Independent Test**: Attempt to access protected API endpoints with a forged/malformed JWT token. System should reject the request with 401.

**Acceptance Scenarios**:

1. **Given** an API request with a forged JWT cookie, **When** the request reaches the server, **Then** it is rejected with 401 Unauthorized
2. **Given** a request to `/api/admin/drizzle-profiles` without valid authentication, **When** processed, **Then** the system returns 401 before accessing any data
3. **Given** a valid authenticated session, **When** the user makes API requests, **Then** their identity is properly verified server-side

---

### User Story 4 - Protected AI Endpoint (Priority: P2)

As a platform owner, I want the AI chat endpoint to be rate-limited and authenticated so that I can control costs and prevent abuse.

**Why this priority**: The current AI endpoint is unauthenticated and unrate-limited, creating a cost amplification vector where attackers could generate unlimited LLM calls.

**Independent Test**: Attempt to call `/api/ai/chat` without authentication or exceed rate limits. System should enforce authentication and rate limiting.

**Acceptance Scenarios**:

1. **Given** an unauthenticated request to the AI endpoint, **When** received, **Then** it is rejected with 401
2. **Given** an authenticated user, **When** they exceed the rate limit (e.g., 10 requests/minute), **Then** subsequent requests receive 429 Too Many Requests
3. **Given** a user under their rate limit, **When** they make requests, **Then** they receive normal AI responses

---

### User Story 5 - Safe Input Validation (Priority: P2)

As a user, I want my profile data to be validated so that malicious input cannot compromise my account or the platform.

**Why this priority**: Current profile updates accept raw FormData without validation, allowing XSS payloads, `javascript:` URIs, and invalid data to be stored and potentially executed.

**Independent Test**: Submit profile update with XSS payload in website field or `javascript:` URI in avatar_url. System should reject or sanitize the input.

**Acceptance Scenarios**:

1. **Given** a profile update with XSS in the website field, **When** submitted, **Then** the system rejects or sanitizes the input
2. **Given** an avatar_url containing `javascript:alert(1)`, **When** submitted, **Then** the system rejects the URL as invalid
3. **Given** valid profile data, **When** submitted, **Then** the profile is updated successfully

---

### Edge Cases

- What happens when middleware throws an error during session update? System should gracefully handle and not expose internal errors
- How does system handle rate limit exhaustion? User should receive clear 429 response with retry-after header
- What happens when monitoring service is unavailable? Errors should fallback to console logging, never be silently lost
- How does system handle extremely large input payloads? Input size should be limited to prevent DoS
- What happens when user role is undefined in metadata? System should check database fallback or deny access gracefully

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST activate Next.js middleware by creating `src/middleware.ts` that exports the proxy function as default
- **FR-002**: System MUST remove the `isDev` gate from `logger.error()` and `logger.warn()` to enable production error logging
- **FR-003**: System MUST replace `getSession()` with `getUser()` in all API routes for verified authentication
- **FR-004**: System MUST implement rate limiting on the AI chat endpoint (10 req/min per user, sliding window) with authenticated user verification
- **FR-005**: System MUST validate all profile update inputs using `ProfileSchema` before database writes
- **FR-006**: System MUST adopt nonce-based Content Security Policy headers, removing `'unsafe-inline'` and `'unsafe-eval'`
- **FR-007**: System MUST remove the `noOpLock` auth lock bypass to restore token refresh protection
- **FR-008**: System MUST move academic onboarding data writes from JWT metadata to the profiles table
- **FR-009**: System MUST move brute-force lockout counter from localStorage to sessionStorage
- **FR-010**: System MUST remove manual DOM manipulation from `useToast.ts` and migrate to sonner
- **FR-011**: System MUST fix the quiz player timer to prevent reset on score changes
- **FR-012**: System MUST separate PII from localStorage cache, keeping only public data persistent
- **FR-013**: System MUST move hardcoded Cloudinary credentials to environment variables

### Key Entities

- **Session/Middleware**: Route protection, token refresh, and CSP header injection
- **Logger**: Error capture and forwarding to monitoring services
- **User/Profile**: Authentication state, role-based access, and user data
- **Rate Limit**: Request throttling per user/IP for expensive operations
- **CSP Policy**: Security headers preventing XSS execution

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of admin routes return 401/403 for unauthenticated/unauthorized access attempts
- **SC-002**: 100% of production errors are captured and visible in monitoring dashboard (zero silent failures)
- **SC-003**: AI endpoint enforces authentication and rate limits (max 10 req/min per user)
- **SC-004**: All user inputs validated; XSS and `javascript:` URI payloads rejected 100% of the time
- **SC-005**: CSP headers exclude `'unsafe-inline'` and `'unsafe-eval'` directives
- **SC-006**: Quiz timer maintains consistent countdown without pauses or resets
- **SC-007**: No PII stored in localStorage; only public data cached client-side

---

## Assumptions

- Vercel platform will be used for deployment with available KV for rate limiting
- Sentry or similar error monitoring service is available for production logging
- Supabase RLS policies will be verified and enforced as secondary protection layer
- Users have JavaScript enabled (required for security features like CSP nonce)
- Existing admin users have their roles properly populated in `app_metadata`
- The fix for onboarding modal will resolve the infinite redirect loop for new users

---

## Dependencies

- Next.js 16.2.1 with App Router support
- Supabase Auth for session management
- Sentry SDK for error monitoring (optional but recommended)
- Vercel KV or Upstash for rate limiting
- Existing profiles table schema accommodates academic data fields
