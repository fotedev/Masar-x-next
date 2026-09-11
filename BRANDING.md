# Masar X — Brand Guidelines

Single source of truth for brand names, voice, and visual tokens. All agents and
contributors MUST pull UI text and colors from here (and from the i18n files referenced
below) instead of inventing values. Spec 006 §3 governs; this file is the token sheet.

## Product Identity

| Token | Value | Where it lives |
|---|---|---|
| Product name (en) | **Masar X** | `packages/shared/src/messages/en/metadata.json` (`siteName`), `apps/web/public/manifest.json` |
| Product name (ar) | **مسار إكس** | `packages/shared/src/messages/ar/metadata.json` (`siteName`) |
| Title template (en) | Masar X - Study Summaries Platform | `en/metadata.json` (`title`) |
| Title template (ar) | مسار إكس - منصة ملخصات دراسية | `ar/metadata.json` (`title`) |
| Tagline (ar) | بوابتك الأكاديمية الذكية للملخصات والمواد والاختبارات | brand copy — use via i18n keys, never inline |
| AI persona (ar) | **زين** | `ar/aiAssistant.json`, `ChatContainer.tsx` (`locale.startsWith("ar")`) |
| AI persona (en) | **ZANE** | `ChatContainer.tsx` fallback — not "Zain" |
| Footer credit | Made with ♥ by Aboalayoun | `Footer.tsx` — order fixed for RTL (spec 006 §3) |
| Developer credit | Aboalayoun — AI student | `Footer.tsx`, `footer/FooterDeveloper.tsx` |

**Rule:** any NEW user-facing string goes to the matching namespace under
`packages/shared/src/messages/{ar,en}/` with both languages filled. Hardcoded Arabic in
`.ts/.tsx` is a defect (AGENTS.md invariant I3).

## Tone of Voice

- Encouraging, academic, direct, student-supportive (مشجع، أكاديمي، مباشر، وداعم للطلاب).
- Address the student in the second person; keep study-jargon minimal.
- Error copy never blames the user; always offer a next step (retry / sign-in hint).

## Color Tokens

Defined once as CSS channel variables in `apps/web/src/index.css` (light `:root` +
`.dark` overrides) and exposed to Tailwind as `colors.brand.*`
(`apps/web/tailwind.config.js`, `rgba(var(--brand-*), <alpha-value>)`).

**Always use the Tailwind utilities (`bg-brand-blue`, `text-brand-navy`, …) or the CSS
variables — never raw hex values in components.**

| Token | Light (RGB) | ≈ Hex | Dark (RGB) | ≈ Hex |
|---|---|---|---|---|
| `--brand-navy` | `15, 23, 42` | `#0F172A` | `2, 6, 23` | `#020617` |
| `--brand-blue` | `59, 130, 246` | `#3B82F6` (blue-500) | `96, 165, 250` | `#60A5FA` (blue-400) |
| `--brand-sky` | `14, 165, 233` | `#0EA5E9` (sky-500) | `56, 189, 248` | `#38BDF8` (sky-400) |
| `--brand-orange` | `245, 158, 11` | `#F59E0B` (amber-500) | `251, 191, 36` | `#FBBF24` (amber-400) |

Gradients (also in `index.css`): primary `navy → #1E3A8A`, secondary `blue → sky`,
accent `orange → #FBBF24`, success `#10B981 → #34D399`. The AI chat uses the sky/cyan
accent family inline — treat sky as the assistant's accent color.

> Note: spec brainstorming proposed `#2563EB` (blue-600) as Brand Blue. **Not adopted** —
> the shipped token is blue-500 (`#3B82F6`). Do not "correct" components to blue-600.

## RTL & Typography

- `next-intl` sets `<html dir>`; components use logical CSS properties only
  (`ms-`, `me-`, `border-e-`, …) — never `left/right` (AGENTS.md §7).
- Latin fragments inside Arabic text are wrapped with `lang="en" dir="ltr"` +
  the `bidi-ltr` helper (defined in `apps/web/src/index.css`:
  `direction: ltr; unicode-bidi: isolate;`) so mixed-direction text can't reorder.
- Dark mode is calibrated for late-night study and must keep the `ThemeScript.tsx`
  native `<script>` pattern (gotcha #19).

## Platform Naming

| Surface | Name | Notes |
|---|---|---|
| Web / PWA | Masar X | `manifest.json`, Vercel deploy |
| Desktop | Masar X Desktop | Electron 32, wraps the web build |
| Mobile (primary) | Masar X Native | Expo / React Navigation |
| Mobile (light) | **Masar X Lite** | Capacitor wrapper — planned (spec 006 §2B), name reserved |
| AI assistant | زين / ZANE | ar / en |

Institutional deployments (e.g. BIS fork) customize via `NEXT_PUBLIC_COLLEGE_NAME`
(see `.env.example`); the product name stays **Masar X**.
