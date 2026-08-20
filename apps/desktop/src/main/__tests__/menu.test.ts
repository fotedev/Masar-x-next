import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// T024 — Contract test for the native menu bar (menu.ts)
//
// Spec: specs/004-multi-platform-expansion/tasks.md §T024
//       (FR-002: native menu bar with platform-correct keyboard shortcuts)
//
// This test defines the contract that `apps/desktop/src/main/menu.ts`
// must satisfy. It is written FIRST (TDD red phase). It MUST fail until
// T024 implements `buildAppMenu`.
//
// The contract has three assertions:
//   1. Standard menus use Electron's `role` (fileMenu / editMenu / viewMenu
//      / windowMenu / appMenu) — NOT handcoded items with manual
//      accelerators. The role is what gives us OS-correct i18n,
//      native C++ handlers, and platform-specific shortcuts.
//   2. The Help menu has the custom items we want:
//      - "Learn More"     → opens https://masarx.ai in default browser
//      - "Documentation"  → opens https://docs.masarx.ai in default browser
//      - "Check for Updates…" → invokes the injected callback
//   3. The "Check for Updates…" item's click handler invokes the
//      `onCheckForUpdates` callback (NOT a hardcoded action).
// ============================================================================

// --- electron mock ------------------------------------------------------------
// We intercept `Menu.buildFromTemplate` so the test can inspect the
// template array (the actual menu object isn't built — we just look
// at what the production code passed in).

type MenuItem = Record<string, unknown> & { label?: string; role?: string; submenu?: MenuItem[] };

// `vi.hoisted` runs the initializer BEFORE the `vi.mock` factory
// (vitest hoists both). The factory below captures the hoisted refs
// without tripping over the temporal dead zone.
const { buildFromTemplateMock, openExternalMock } = vi.hoisted(() => ({
  buildFromTemplateMock: vi.fn((template: MenuItem[]) => ({ items: template })),
  // The URL argument type is `string` in production; we use a rest
  // signature here so the mock accepts whatever the call site passes
  // (the production code in `menu.ts` calls `shell.openExternal(url)`
  // with a string literal).
  openExternalMock: vi.fn(async (..._args: unknown[]) => undefined),
}));

vi.mock('electron', () => ({
  Menu: {
    buildFromTemplate: (template: MenuItem[]) => buildFromTemplateMock(template),
  },
  shell: {
    openExternal: (url: string) => openExternalMock(url),
  },
}));

// Import AFTER mocks. Vitest hoists vi.mock() so this is safe.
import { buildAppMenu } from '../menu.js';

// --- tests -------------------------------------------------------------------

describe('T024 — Native menu bar contract', () => {
  it('uses Electron role for File/Edit/View/Window (built-in menus)', () => {
    buildFromTemplateMock.mockClear();
    buildAppMenu({ onCheckForUpdates: vi.fn() });

    // The factory must have been called with a template that uses
    // `role: 'fileMenu' | 'editMenu' | 'viewMenu' | 'windowMenu'` for
    // the four standard sections. We do NOT check for specific items
    // inside those sections — that's Electron's job via the role.
    const call = buildFromTemplateMock.mock.calls.at(-1);
    expect(call).toBeDefined();
    const template = call![0] as MenuItem[];

    const roles = template.map((item) => item.role);
    expect(roles).toContain('fileMenu');
    expect(roles).toContain('editMenu');
    expect(roles).toContain('viewMenu');
    expect(roles).toContain('windowMenu');

    // Each role item should NOT have hand-rolled `accelerator` fields
    // (Electron's role supplies the right accelerators automatically).
    for (const item of template) {
      if (item.role && item.role !== 'help') {
        expect(item.accelerator).toBeUndefined();
      }
    }
  });

  it('Help menu has Learn More, Documentation, and Check for Updates items', () => {
    buildFromTemplateMock.mockClear();
    buildAppMenu({ onCheckForUpdates: vi.fn() });

    const call = buildFromTemplateMock.mock.calls.at(-1);
    expect(call).toBeDefined();
    const template = call![0] as MenuItem[];

    const helpItem = template.find((item) => item.role === 'help');
    expect(helpItem).toBeDefined();
    expect(helpItem!.submenu).toBeDefined();

    const submenu = helpItem!.submenu!;
    const labels = submenu.map((s) => s.label);
    expect(labels).toContain('Learn More');
    expect(labels).toContain('Documentation');
    expect(labels).toContain('Check for Updates…');
  });

  it('Check for Updates click invokes the injected callback', async () => {
    buildFromTemplateMock.mockClear();
    const onCheckForUpdates = vi.fn();
    buildAppMenu({ onCheckForUpdates });

    const call = buildFromTemplateMock.mock.calls.at(-1);
    expect(call).toBeDefined();
    const template = call![0] as MenuItem[];

    const helpItem = template.find((item) => item.role === 'help')!;
    const checkItem = helpItem.submenu!.find((s) => s.label === 'Check for Updates…')!;
    expect(checkItem.click).toBeDefined();

    // Simulate the click.
    await (checkItem.click as () => void)();
    expect(onCheckForUpdates).toHaveBeenCalledTimes(1);
  });
});
