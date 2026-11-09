// Spec 040 — shared next-intl mock factory. Existing tests inline this
// boilerplate (SubjectsGrid, useCourses, AuthContext); centralizing it
// keeps every new component/page/hook test consistent.
//
// Usage (the ONLY working form, vitest 2 through 5): each test file calls
// vi.mock("next-intl", () => nextIntlMockFactory()) at its own top level —
// the deferred inline wrapper only executes the factory after this module
// has fully evaluated. Do NOT put a vi.mock() call inside this helper: the
// vitest:mocks transform hard-errors on vi.mock outside a module's top
// level (vitest 5), which would poison every file importing the factory.
// intlState is a plain module-level object; mutate the locale via
// setMockIntlLocale() (typically in beforeEach) BEFORE rendering.
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
 *  immune to TDZ under the mock-hoisting transform. */
export function nextIntlMockFactory() {
  return {
    useLocale: () => intlState.locale,
    useTranslations: makeT,
    getTranslations: makeT,
  };
}
