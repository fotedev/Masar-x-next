import { vi } from 'vitest';

// Spec 040 — shared next-intl mock factory. Existing tests inline this
// boilerplate (SubjectsGrid, useCourses, AuthContext); centralizing it
// keeps every new component/page/hook test consistent.
//
// vi.mock() calls are hoisted above imports and cannot close over module
// locals — the state holder must be created with vi.hoisted() so the
// hoisted factory can reference it. Mutate the locale via
// setMockIntlLocale() (typically in beforeEach) BEFORE rendering.
export const intlState = vi.hoisted(() => ({
  locale: 'ar' as string,
}));

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

/** vi.mock('next-intl', nextIntlMockFactory) — namespace-echo mock. */
export const nextIntlMockFactory = () => ({
  useLocale: () => intlState.locale,
  useTranslations: makeT,
  getTranslations: makeT,
});

/** Convenience wrapper: mockNextIntl() at the top of a test file. */
export function mockNextIntl(): void {
  vi.mock('next-intl', nextIntlMockFactory);
}
