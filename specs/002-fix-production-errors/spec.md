# Feature Specification: Fix Production Errors

**Feature Branch**: `002-fix-production-errors`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User description: "Fix production errors: 500 Internal Server Error on /api/auth/sync endpoint, CSP blocking eval in JavaScript, form field accessibility issues (missing label associations and id/name attributes), and service worker fetch failures"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stable Authentication Sync (Priority: P1)

As a user, I want my authentication state to sync reliably without server errors, so that my profile information is always up to date and I don't experience retry loops.

**Why this priority**: Critical for core application functionality and user session stability.

**Independent Test**: Can be tested by signing in and observing the network tab for successful 200 responses from `/api/auth/sync`.

**Acceptance Scenarios**:

1. **Given** a user signs in, **When** the profile sync is triggered, **Then** it must return a 200 OK status.
2. **Given** a failed sync attempt, **When** the system retries, **Then** it must implement exponential backoff instead of infinite immediate retries.

---

### User Story 2 - Secure and Functional JavaScript (Priority: P1)

As a user, I want the application features that rely on dynamic script execution to work in production without being blocked by security policies.

**Why this priority**: Essential for features relying on third-party libraries (like animations or PDF rendering) that might use dynamic evaluation.

**Independent Test**: Verify by checking the browser console for CSP "blocked" errors in production environments.

**Acceptance Scenarios**:

1. **Given** the production environment, **When** the application loads, **Then** no "Content Security Policy: The page's settings blocked the unexpected evaluation of a script" errors should appear.

---

### User Story 3 - Accessible Forms (Priority: P2)

As a user utilizing assistive technologies or browser autofill, I want form fields to be properly labeled and identifiable, so that I can easily fill out information.

**Why this priority**: Important for inclusivity, accessibility compliance (WCAG), and improved UX through autofill.

**Independent Test**: Use Lighthouse or Axe accessibility tools to verify label-input associations.

**Acceptance Scenarios**:

1. **Given** a form, **When** inspected with accessibility tools, **Then** all inputs must have associated labels via `htmlFor`/`id` match.
2. **Given** an input field, **When** autofill is used, **Then** the browser correctly identifies the field purpose via its `name` attribute.

---

### User Story 4 - Resilient Service Worker (Priority: P3)

As a user, I want navigation to work smoothly even if the service worker fetch fails, without seeing cluttered error logs in the console.

**Why this priority**: Improves developer experience and avoids user confusion from visible console errors.

**Independent Test**: Simulate offline mode and verify that navigation fetch failures are handled gracefully without verbose error logging.

**Acceptance Scenarios**:

1. **Given** a failed navigation fetch in the service worker, **When** the error is caught, **Then** a graceful fallback is served without logging a full stack trace to the console.

---

### Edge Cases

- **Auth Sync during high load**: How does the system handle concurrent sync requests if multiple tabs are opened? (Implemented debounce/ref check).
- **Missing Env Vars**: What happens if `DATABASE_URL_IPV4` is missing in production? (Fallback to original and log specific error).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST ensure `/api/auth/sync` uses the Supabase Session Pooler (IPv4 compatible) in production environments.
- **FR-002**: System MUST implement a request guard in `AuthContext` to prevent concurrent and redundant sync calls.
- **FR-003**: System MUST provide detailed server-side logging for `/api/auth/sync` failures while returning a sanitized response to the client.
- **FR-004**: System MUST configure CSP in `middleware.ts` to support necessary script evaluation while maintaining security.
- **FR-005**: All form `<input>`, `<select>`, and `<textarea>` elements MUST have unique `id` and `name` attributes.
- **FR-006**: All form labels MUST correctly use the `htmlFor` attribute to associate with their respective inputs.
- **FR-007**: Service worker fetch handlers MUST catch navigation errors and return a fallback response (e.g., offline page or cached root).

### Key Entities *(include if feature involves data)*

- **User Profile**: Represents the user's synchronization state between Auth provider and application database.
- **CSP Policy**: The security configuration governing script execution and resource loading.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero 500 Internal Server Errors from `/api/auth/sync` across all production sessions.
- **SC-002**: 100% of forms on the site pass the "Labels are associated with form fields" accessibility check in Lighthouse.
- **SC-003**: Zero "script-src" CSP violations reported in the production console related to the main application bundle.
- **SC-004**: Service worker console logs show only meaningful warnings, not routine fetch failures.

## Assumptions

- `DATABASE_URL_IPV4` (Supabase Session Pooler) will be provided in Vercel environment variables.
- The existing `AuthContext` architecture is the primary source of truth for auth state.
- Production environment detection in Middleware is reliable (using `process.env.NODE_ENV` or `process.env.VERCEL_ENV`).

