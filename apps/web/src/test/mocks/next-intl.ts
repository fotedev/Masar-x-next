import { vi } from 'vitest';

// Spec 040 — shared next-intl mock factory. Existing tests inline this
// boilerplate (SubjectsGrid, useCourses, AuthContext); centralizing it
// keeps every new component/page/hook test consistent.
//
// The namespace echo (`ns.key`) makes branch coverage observable: tests
// assert the exact translation key a component renders, matching the
// established pattern.
export function mockNextIntl(locale = 'ar') {
  vi.mock('next-intl', () => ({
    useLocale: () => locale,
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, unknown>) => {
        const suffix =
          values && Object.keys(values).length > 0
            ? ` ${JSON.stringify(values)}`
            : '';
        return `${ns}.${key}${suffix}`;
      },
    getTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, unknown>) => {
        const suffix =
          values && Object.keys(values).length > 0
            ? ` ${JSON.stringify(values)}`
            : '';
        return `${ns}.${key}${suffix}`;
      },
  }));
}
