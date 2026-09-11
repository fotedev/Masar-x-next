# Masar X — Promo Asset Bundle

> Headless captures of the **5 most impactful front-facing routes** of the
> Masar X web app (`apps/web`), each paired with a copy-paste-ready
> **Image-to-Video (I2V) motion prompt** for platforms like Kling, Runway,
> Luma, and the Arena/LMSYS showcase.
>
> All screenshots are **1920×1080** (16:9), captured at
> `http://localhost:3000` against the `en` locale, with theme set to
> `dark`, animations frozen at end-state, and a 3.5 s settle delay for
> hydration + lazy chunks. The bundle is **re-runnable** via
> `scripts/promo_screenshots.py`.

---

## 1. Discovered route surface (filtered to 5 promo-worthy routes)

Route discovery ran against `apps/web/src/app/`. The locale-prefixed segment
`[locale]` is enumerated from `apps/web/src/i18n/routing.ts` (`ar`, `en`,
`localePrefix: "always"`). The primary nav is defined in
`apps/web/src/components/Header.tsx` (`primaryNavItems`) — that nav is the
authoritative source for "front-facing pages a user can reach from the
header". The five routes below are the most visually distinct for a promo.

| # | Slug              | Path                     | Nav key      | Why it earns a scene in the promo                                                                                          |
| - | ----------------- | ------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 1 | `home`            | `/en`                    | `home`       | The platform hub. Establishes the "all-in-one" promise: **Ask ZANE AI** gradient card, **Download Masar X** banner, four quick-nav tiles. |
| 2 | `ai-assistant`    | `/en/ai-assistant`       | `assistant`  | The ZANE AI hero — glowing avatar, cyan wordmark, four quick-prompt cards, Puter Mode (Claude 4.6 Sonnet). The AI's "personality" beat. |
| 3 | `subjects`        | `/en/subjects`           | `subjects`   | Academic breadth — 7 subject modules (Programming Fundamentals, Digital Circuits, etc.). Answers "what does Masar X cover?" |
| 4 | `quizzes`         | `/en/quizzes`            | `quizzes`    | Practice & exam engine — filter row (Level, Semester, Department, Subject), previous exams panel. Sells "practice → mastery". |
| 5 | `downloads`       | `/en/downloads`          | `downloads`  | The CTA closer — multi-platform desktop app, Windows installer + portable, macOS / Android "Coming soon", works-offline pillars. |

> **Why these 5 and not more?** The user spec asked for **4 to 6 core pages**.
> `news`, `courses`, `trw` (The Real World, gated), and the auth pages
> (`/login`, `/signup`) are either feature-redundant with the above or
> require auth — they would not add visual variety to a promo. Subject
> detail pages (`/subjects/[subject]`) and quiz play
> (`/quiz-play/[quizId]`) are great for a product tour, not for a 30–45 s
> ad.

---

## 2. Asset layout

```
promo_assets/
├── README.md                   ← this file
├── home/
│   ├── screenshot.png          ← 1920×1080 PNG
│   └── motion_prompt.md        ← I2V prompt + camera + lighting + cursor + transition
├── ai-assistant/
│   ├── screenshot.png
│   └── motion_prompt.md
├── subjects/
│   ├── screenshot.png
│   └── motion_prompt.md
├── quizzes/
│   ├── screenshot.png
│   └── motion_prompt.md
└── downloads/
    ├── screenshot.png
    └── motion_prompt.md
```

**Run again:**

```bash
python scripts/promo_screenshots.py
```

(re-creates every `screenshot.png` in place; the `motion_prompt.md` files
are not regenerated — they are the source of truth for the prompt copy.)

---

## 3. Scene order & narrative flow

The five scenes form a continuous **Hook → Feature exploration → Core AI
power → Practice / action → Call to action** arc. Camera + transitions are
designed to be non-repetitive: each scene introduces a new motion
vocabulary (push-in, crane, dolly, scan-line, dolly-forward + tilt-up)
and a different transition type (blur-wipe, fade-through-black, slide-left,
cyan flash, fade-to-black).

| Scene | Slug            | Narrative beat          | Camera (primary)                        | Transition out                          |
| ----- | --------------- | ----------------------- | --------------------------------------- | --------------------------------------- |
| 1     | `home`          | Hook + dashboard intro  | Push-in + parallax pan-right            | Horizontal blur-wipe                    |
| 2     | `ai-assistant`  | Meet ZANE               | Static hold + zoom-in + pull-back       | Fade-through-black                      |
| 3     | `subjects`      | Feature exploration     | Top-down crane + dolly-right + tilt-down | Slide-left + blur-wipe                  |
| 4     | `quizzes`       | Practice / exam bank    | Static hold + push-in                   | Hard cut + cyan flash                   |
| 5     | `downloads`     | CTA + offline           | Dolly forward + tilt-up                 | Fade-to-black (final beat + synth stab) |

---

## 4. Copy-paste motion prompts (concise, platform-agnostic)

The full per-scene prompts (with camera, lighting, cursor, and transition
detail) live in each `motion_prompt.md`. Below are the **concise, paste-ready
prompt bodies** — one paragraph each, suitable for I2V fields in Kling,
Runway, Gen-3, Luma, and similar. Pair each with its
`promo_assets/<slug>/screenshot.png` as the `image` / first-frame input.

### Scene 1 — `home` (Hook + Solution intro)

> Image input: `promo_assets/home/screenshot.png`

```
Cinematic 16:9 promo shot opening on a dark navy learning-platform
dashboard. Slow push-in toward the gradient blue-indigo "Ask ZANE AI"
card on the left; a soft cyan glow blooms behind it. A single animated
cursor slides up from the bottom, hovers the "Start chatting now" button,
which emits a crisp light-blue ripple ring. Hold, then a gentle parallax
pan-right reveals four quick-nav tiles (Study materials, Quiz bank, Latest
news, Recent activity) — each tile's icon briefly illuminates with a
color-coded glow as the cursor trails past (blue, purple, yellow, green).
The "Download Masar X v0.5.8" banner across the top pulses softly. Subtle
2.5D perspective tilt, dark navy (#0B1120), neon cyan and electric blue
accents, smooth ease-out camera, subtle digital whoosh on the ripple,
modern lo-fi tech-beat rhythm, no dialogue.
```

### Scene 2 — `ai-assistant` (Meet ZANE)

> Image input: `promo_assets/ai-assistant/screenshot.png`

```
Cinematic 16:9 promo shot opening on the ZANE AI hero. Deep navy void
with a glowing circular robot avatar at center, cyan "ZANE" wordmark
beneath it, the heading "Hello, I am ZANE. How can I help you?", the
"ZANE AI (Programming)" model selector pill, and four quick-prompt
feature cards (Summarize a..., Explain Code, Study Plan, WhatsApp Chats)
above a soft "Ask Anything..." input. The avatar's gradient ring (purple
to electric blue) emits a slow particle pulse. The four cards illuminate
left-to-right with crisp UI micro-clicks; "Explain Code" lifts forward as
a glassmorphism panel. Slow zoom-in toward the avatar, then a gentle
pull-back reveals the model selector expanding with a faint cyan border-
pulse. The cursor glides in from lower-left and hovers the violet "Enable
Puter" button — the button glows softly, the avatar's ring spins one
rotation, a quiet digital whoosh accompanies the transition. Hold, then
fade-through-black. Dark tech aesthetic, subtle 2.5D perspective tilt,
modern lo-fi tech-beat rhythm, no dialogue.
```

### Scene 3 — `subjects` (Feature exploration)

> Image input: `promo_assets/subjects/screenshot.png`

```
Cinematic 16:9 promo shot opening on a deep-navy "Academic Subjects" hub.
Centered white heading with subtitle, then a 4+3 grid of seven subject
cards (Programming Fundamentals, Information Systems Fundamentals,
Interpersonal Communication, Computers and Society, Technical Writing
for Computing, Digital Circuits, Mathematics 2), each with a soft icon in
a rounded square. Top-down crane descent, then a slow dolly-right across
the first row. As the camera passes each card icon, a brief color-coded
glow activates (cyan, blue, pink, indigo). Programming Fundamentals
glows longest and lifts forward as the cursor hovers it — a single click
ripple confirms the selection. Camera continues to tilt-down to the
second row with a gentle 2.5D perspective tilt. The footer at the bottom
(Masar X brand block, Quick links, Support, Developer card) remains
steady. Hold, then slide-left into the next scene. Modern dark-tech
aesthetic, neon cyan and electric blue accents, modern lo-fi tech-beat
rhythm, no dialogue.
```

### Scene 4 — `quizzes` (Practice / exam bank)

> Image input: `promo_assets/quizzes/screenshot.png`

```
Cinematic 16:9 promo shot opening on a dark-navy "Exams" hub. White
"Exams" heading, subtitle "Browse and solve subject exams", and below it
a horizontal filter row with a search input and four dropdowns (All
Levels, All Semesters, All Departments, All Subjects). Static hold, then
a slow push-in toward the filter row as a cyan scan-line sweep glides
left-to-right. A cursor enters from the right, clicks "All Levels" — the
menu opens with a soft glassmorphism panel, the cursor selects "Level 1",
the dropdown snaps shut with a subtle micro-click, and three exam cards
animate in from the bottom: "Computer Science Midterm 2024", "Programming
Fundamentals Quiz", "Digital Circuits Final", each with a difficulty
badge, a question count, and a "Start exam" button. The cards stagger in
over 0.6s. Hold on the full grid, then a hard cut with a quick cyan
flash. Modern dark-tech aesthetic, neon cyan and electric purple accents,
modern lo-fi tech-beat rhythm, no dialogue.
```

### Scene 5 — `downloads` (CTA + offline)

> Image input: `promo_assets/downloads/screenshot.png`

```
Cinematic 16:9 promo shot opening on a dark-navy desktop download hub.
Centered "Desktop App" pill, the white "Download Masar X" heading, the
subtitle "A faster, distraction-free desktop experience with offline
support", and a blue "Download for Windows" CTA. Below it, three platform
cards: Windows (green "Available now" badge, two download buttons —
installer Setup and Portable edition), macOS (grayed, "Coming soon" with
a notify bell), Android (grayed, "Coming soon" with a notify bell). Slow
dolly forward, then a gentle tilt-up to reveal the "Why the desktop app?"
section with three benefit cards (Works offline, Auto-updates, Native
integration). The Windows card's "Available now" green badge pulses
once, the "Download installer (Setup)" button glows soft blue as the
cursor hovers it, the macOS and Android "Notify me when available" bell
buttons each emit a one-shot subtle ring. A faint desktop-window chrome
bar appears briefly over the Windows card. Hold, then a slow fade-to-
black with a bright synth chord stab on the final beat. Modern dark-tech
aesthetic, neon cyan and electric blue accents, 2.5D perspective tilt,
modern lo-fi tech-beat rhythm, no dialogue.
```

---

## 5. Suggested render specs (matches the previous H3 video task)

| Field        | Value                                | Why                                                                                |
| ------------ | ------------------------------------ | ---------------------------------------------------------------------------------- |
| Model        | `MiniMax-H3` (or `H3-Max` for fast)  | Native synchronized audio; 2K resolution. H3 uses **account credits** (not Token Plan allowance). |
| Aspect ratio | 16:9                                 | Matches the screenshots. The first-frame input is 1849×962 (~1.92:1); the output ratio follows the first frame, so the master will be ~1.92:1 and can be cropped to strict 16:9 in post. |
| Resolution   | 2K (H3) / 768P (H3-Max)              | 2K for the marquee scenes, 768P for the fast variant.                               |
| Duration     | 5–15 s per scene (H3 cap)            | Total runtime is 25–75 s across 5 scenes. For a single-cut ad, pick the 5 most cinematic scenes at 15 s each. |
| Input mode   | `reference_type: "first_frame"` (I2V)| Each scene's `screenshot.png` is the first frame.                                  |
| Audio        | Native (H3) — describe in prompt     | `overall_soundscape` for UI clicks / whooshes / typing; `non_diegetic_music` for the lo-fi tech-beat. |

---

## 6. Re-capture

If a route is updated, re-run the script — it overwrites every
`screenshot.png` in place:

```bash
python scripts/promo_screenshots.py
```

The script logs per-route HTTP status + byte size and exits non-zero on
any failure, so it's safe to wire into a CI smoke job. Viewport, settle
delay, and the `color_scheme: "dark"` preference are constants at the top
of `scripts/promo_screenshots.py` if any of them need to change for a
specific capture.
