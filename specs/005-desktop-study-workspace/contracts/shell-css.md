# Contract: Desktop Shell CSS Marker & Classes (spec 005 US2/US3)

**Parties**: `apps/web/src/components/desktop/DesktopShellGate.tsx` (sets the marker) ↔
`apps/web/src/styles/desktop-shell.css` (all rules) ↔ every shell component.
**Hard rule (FR-011)**: every rule in `desktop-shell.css` MUST be scoped under the root marker.
A naked rule that leaks past the marker is a web regression and a hard failure — the file's
header comment says the same, because the browser build must stay byte-for-byte unchanged (SC-010).

## Root marker

| Token | Set by | Meaning |
|---|---|---|
| `[data-masarx-desktop="true"]` on `<html>` | `DesktopShellGate.tsx` effect, only when `isDesktopRuntime()` is true (removed/restored on unmount) | "inside the Electron shell"; gates every shell CSS rule and shell-only rendering decisions |

## Custom properties

| Token | Value | Owner | Consumers |
|---|---|---|---|
| `--masarx-titlebar-h` | `32px` | `[data-masarx-desktop="true"]` (desktop-shell.css) | `CustomTitlebar.tsx` (height), `Layout.tsx` (shell top padding) |

## Class contract

| Class | Applied by | Contract |
|---|---|---|
| `.masarx-titlebar` | `CustomTitlebar.tsx` root `<header>` | gets `-webkit-app-region: drag` + the 32px clamp (`height/max-height: 32px !important; flex: 0 0 32px`). The clamp is the structural guard from the 800px-titlebar incident — do not remove. MUST NOT be named `.z-header` (that selector is reserved for the web header). |
| `.masarx-titlebar-nodrag` | interactive elements inside the strip | opts the element out of the drag region so clicks land (FR-022) |
| `.z-header` | web `Header` root | hidden via `display: none !important` under the marker — hydration-flash guard only; the real chrome decision is the `Layout.tsx` branch (spec 007 §2) |
| `.selectable-content` | study prose surfaces (reader, summaries, assistant replies) | opts back INTO text selection/copy inside the shell (FR-014, SC-006); `AssistantPanel.tsx` documents it as the T020 opt-in point |
| `.draggable` | reserved | re-enables image/link drag for a future surface that needs it (off by default) |

## Global behaviours gated by the marker (FR-013/015/017/018)

`user-select: none` everywhere (except `.selectable-content`), `-webkit-user-drag: none` on
`img`/`a`, root `height: 100%; overflow: hidden` (html + body), slim styled scrollbars with
`scrollbar-gutter: stable` (light + dark variants). See `desktop-shell.css` for the normative
rule list; this file records the *contract*, the CSS file is the *implementation*.

## Layout branching contract (companion to the CSS)

`apps/web/src/components/Layout.tsx` selects the shell structurally: desktop branch renders
`DesktopShell` (titlebar + content, `h-screen w-screen overflow-hidden`) and skips
`Header`/`Footer`/`PWAInstallPrompt`; browser branch renders the standard chrome untouched.
CSS overrides of root-element layout (`body > *`, `#__next`, root `!important` height rules)
are banned (spec 007 ADR-1) — height discipline lives in the marker-scoped file only.
