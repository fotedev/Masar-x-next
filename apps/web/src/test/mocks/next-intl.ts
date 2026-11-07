import { vi } from 'vitest';

// Spec 040 — shared next-intl mock factory. Existing tests inline this
// boilerplate (SubjectsGrid, useCourses, AuthContext); centralizing it
// keeps every new component/page/hook test consistent.
//
// vi.mock() calls are hoisted above imports, so the shared factory must be
// invoked through a deferred inline wrapper — vi.mock("next-intl",
// () => nextIntlMockFactory()) — which only executes after this module has
// fully evaluated. intlState is therefore a plain module-level object (a
// top-level `export const x = vi.hoisted(...)` cannot be exported under
// vitest 2.1.8's mock-hoisting transform, which broke every import of this
// helper). Mutate the locale via setMockIntlLocale() (typically in
// beforeEach) BEFORE rendering.
//
// Known-broken under vitest 2.1.8 hoisting (do not use):
//  - vi.mock("next-intl", nextIntlMockFactory)  — the factory ARGUMENT is
//    evaluated at hoist time, before the import binding initializes (TDZ).
//  - mockNextIntl() — the hoistMocks transform also rewrites this helper
//    module and hoists its internal vi.mock above the factory declaration.
// Only the deferred inline wrapper form is verified working.
export const intlState = {
  locale: 'ar' as string,
};

export function setMockIntlLocale(locale: string): void {
  intlState.locale = locale;
}

function makeT(ns: string) {
  return (key: string, values?: Record<string, unknown>) => {
    const suffix =
      values && Object.keys(values).length > 0
        ? ` ${JSON.stringify(values)}`
        : '';
    return `${ns}.${key}${suffix}`;
  };
}

/** vi.mock('next-intl', () => nextIntlMockFactory()) — namespace-echo mock.
 *  Function DECLARATION on purpose: a hoisted vi.mock may reference this
 *  binding before module evaluation finishes, and only a declaration is
 *  immune to TDZ under vitest 2.1.8's mock-hoisting transform. */
export function nextIntlMockFactory() {
  return {
    useLocale: () => intlState.locale,
    useTranslations: makeT,
    getTranslations: makeT,
  };
}

/** Convenience wrapper — BROKEN under vitest 2.1.8 hoisting, kept only so
 *  the export surface doesn't silently disappear. See the file header. */
export function mockNextIntl(): void {
  vi.mock('next-intl', nextIntlMockFactory);
}
