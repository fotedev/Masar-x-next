import { Menu, shell, type MenuItemConstructorOptions } from 'electron';

// ============================================================================
// menu.ts — Native menu bar (T024)
//
// Spec: specs/004-multi-platform-expansion/tasks.md §T024
//       (FR-002: native menu bar with platform-correct keyboard shortcuts)
//
// The standard menus (File / Edit / View / Window) are built using
// Electron's `role` property — NOT handcoded items. `role` gives us
// the OS-correct menu (with the right accelerators, native C++
// handlers, and i18n) for free. The custom items are only the ones
// Electron doesn't know about: the help links and the updater trigger.
//
// `buildAppMenu` is a PURE function that takes the updater callback
// as an injected dependency, so the test can verify the wiring
// without instantiating the real Updater.
// ============================================================================

export interface MenuOptions {
  /** Called when the user picks "Check for Updates…" in the Help menu. */
  onCheckForUpdates: () => void | Promise<void>;
}

const HELP_LINKS = {
  learnMore: 'https://masarx.ai',
  documentation: 'https://docs.masarx.ai',
} as const;

export function buildAppMenu(opts: MenuOptions): Electron.Menu {
  const isMac = process.platform === 'darwin';

  // Build the template. We use `role` for every standard menu so
  // Electron builds the platform-correct version (i18n, accelerators,
  // native handlers). The only handcoded items are under Help, where
  // the labels and behaviors are app-specific.
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' } as MenuItemConstructorOptions]
      : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: () => {
            // Fire-and-forget; openExternal returns a Promise but the
            // menu's click handler is sync. Errors are logged.
            shell.openExternal(HELP_LINKS.learnMore).catch((err: unknown) => {
              // eslint-disable-next-line no-console
              console.error('[masarx-desktop] openExternal(learnMore) failed:', err);
            });
          },
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal(HELP_LINKS.documentation).catch((err: unknown) => {
              // eslint-disable-next-line no-console
              console.error('[masarx-desktop] openExternal(documentation) failed:', err);
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Check for Updates…',
          click: () => {
            // Fire-and-forget; updater's checkFor returns a Promise.
            Promise.resolve(opts.onCheckForUpdates()).catch((err: unknown) => {
              // eslint-disable-next-line no-console
              console.error('[masarx-desktop] onCheckForUpdates failed:', err);
            });
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
