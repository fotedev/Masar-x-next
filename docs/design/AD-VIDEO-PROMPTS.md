# Masar X — professional AI ad (prompts + assembly script)

Ad duration: **30 seconds** · 1920×1080 (with a 1080×1920 variant) · 24fps cinematic

---

## Read this first — the working rule

**Do not ask any AI tool to write Arabic text inside the video.** Every model (Sora 2, Veo 3, Runway Gen-4, Kling 2.5) outputs distorted, disconnected Arabic glyphs. This is not a prompt-crafting issue — it is a hard model limitation.

The correct approach, the same one used in paid ads:

| Layer | Who makes it |
|---|---|
| Atmosphere, motion, lighting, faces, emotions | the AI tool (the prompts below) |
| Arabic text, logo, CTA, URL | you, in CapCut / Premiere / Canva |
| Music + voice-over | a separate audio tool (script in section 4) |

Every prompt below has a `Screen content:` line — request a screen that is **lit but shows no legible text** (blurred UI, no legible text). You then overlay the real UI yourself.

### Best quality path: image-to-video, not text-to-video

You have a big advantage: the platform actually exists. Take **real screenshots** of `masarx.vercel.app` (dark mode), composite them onto a desk/phone photo in Photoshop or Canva, then feed the image as the **first frame** to Runway Gen-4 or Kling. Result: your real product, with cinematic motion, zero model hallucination.

Use `text-to-video` only for shots without a screen (shots 1 and 7).

---

## 1. Visual identity — paste into every prompt

```
COLOR GRADE (verbatim in every prompt):
deep midnight navy #020617 base, interface blue #3B82F6 key light,
horizon sky cyan #0EA5E9 rim light, single amber #F59E0B accent only.
Teal-and-orange cinematic grade, crushed blacks, low-saturation midtones.

LENS / CAMERA:
anamorphic 35mm, shallow depth of field f/1.8, subtle film grain,
slow deliberate camera moves only — dolly, push-in, parallel track.

TONE:
premium tech advertisement, calm and confident, not hyperactive.
```

**The amber rule (Amber Gate):** the color `#F59E0B` may appear at exactly one small point in the frame — a light point, a reflection, a button. If more than 10% of the frame turns amber, the ad loses its identity. This rule is documented in the project's `DESIGN.md`.

---

## 2. The prompts — 8 shots

> Each shot is 3–4 seconds. Veo 3 and Sora 2 output 8 seconds, so request one shot at a time and trim it in the edit.

### Shot 1 — the pain (0:00–0:03) · text-to-video

```
Cinematic close-up, late night university dorm room, 2 AM. A young Middle
Eastern male student in his early twenties sits slumped at a cluttered desk,
head resting on one hand, exhausted. Around him: scattered photocopied
lecture papers, three open notebooks, a cold cup of tea, a dead highlighter.
Only light source is a small desk lamp casting warm falloff, and cold blue
moonlight through a window behind him.
Camera: slow 20cm dolly-in toward his face, ends on his eyes.
Screen content: none — no screens in frame.
Mood: quiet defeat, not melodrama. He is tired, not crying.
Deep midnight navy #020617 shadows, cold blue #3B82F6 window light,
one warm amber #F59E0B lamp glow. Anamorphic 35mm, f/1.8, film grain.
```

### Shot 2 — the awakening (0:03–0:06) · image-to-video (start from a powered-off phone image)

```
Extreme close-up on a smartphone lying face-up on the same messy desk.
The screen wakes and illuminates from black, a soft blue #3B82F6 glow
spilling upward across the papers and the student's hand reaching for it.
Camera: locked-off macro, only the light changes — the glow expands.
Screen content: abstract blurred dark-navy interface, soft glowing cards,
completely out of focus and unreadable. NO text of any kind.
The blue light reflects in the student's eye at the edge of frame.
Deep navy #020617, blue #3B82F6 screen bloom. Anamorphic 35mm, f/1.4.
```

Now composite a real screenshot of the home page over the blurred screen in the edit (corner-pin / mask).

### Shot 3 — chaos organizes (0:06–0:10) · text-to-video

```
Abstract product metaphor, no people. Hundreds of loose paper sheets float
chaotically in a dark void, tumbling and disordered. They accelerate inward
and snap into a single perfectly aligned vertical stack, then flatten into
one clean glowing rectangular card floating in space.
Camera: slow orbit 30 degrees around the forming stack.
Screen content: the final card glows softly with blurred abstract lines
suggesting text — nothing legible. NO letters.
Motion: papers move with weight and air resistance, then decisive snap.
Deep midnight navy #020617 void, blue #3B82F6 edge light on paper,
cyan #0EA5E9 rim on the final card. Volumetric haze, film grain.
```

### Shot 4 — ZANE / the AI assistant (0:10–0:14) · text-to-video

```
Abstract representation of artificial intelligence, no face, no robot,
no humanoid. A dense cluster of thin luminous filaments in dark space
pulses once, then a single bright pathway ignites and travels smoothly
through the network from left to right, leaving a soft glowing trail.
Camera: slow lateral track following the travelling light.
The pathway pulse is cyan #0EA5E9 turning to a single amber #F59E0B
flare at the moment it resolves — one flare only, small, centered.
Screen content: none.
Feeling: intelligence explaining, not intelligence surveilling. Calm.
Deep navy #020617, blue #3B82F6 filaments. Anamorphic, shallow DOF.
```

> **Note:** do not request a robot. The project has its own mascot (`LoginRobot.tsx` + `ai-robo.lottie`) — overlay it as a Lottie layer on this shot in the edit; far better than a hallucinated robot.

### Shot 5 — courses and lectures (0:14–0:18) · image-to-video (start from a courses-page screenshot)

```
A laptop on a clean wooden desk in a dim room, screen bright, viewed from
a low three-quarter angle. A hand scrolls a smooth continuous scroll and
the interface glides. Warm morning light rakes in from the left side.
Camera: slow push-in over the keyboard toward the screen.
Screen content: dark navy interface, rows of glowing rectangular cards
with soft thumbnails — deliberately soft-focus and unreadable. NO text.
Motion: the scroll is smooth and unhurried, easing to a stop.
Navy #020617 room, blue #3B82F6 screen spill, one warm #F59E0B
practical light in the deep background bokeh.
```

### Shot 6 — quizzes and confidence (0:18–0:22) · text-to-video

```
Medium close-up, same student, now in a bright university library by day.
He is upright, focused, tapping confidently on a tablet, then a small
satisfied exhale and a slight nod — he got it right. Natural, understated.
Camera: static, then a 15cm push-in on the nod.
Screen content: tablet glows, abstract blurred interface, NO legible text.
Lighting: soft daylight from tall windows, cool blue-white fill.
Same colour discipline: navy shadows, blue #3B82F6 key,
a single amber #F59E0B highlight on his shoulder from a warm lamp.
Mood: quiet competence. NOT celebration, NOT fist-pumping.
```

### Shot 7 — the result (0:22–0:26) · text-to-video

```
Wide cinematic shot. The same student walks with easy confidence down a
long sunlit university corridor, laptop bag over one shoulder, other
students blurred in the foreground and background. He passes through a
shaft of warm light and out of it.
Camera: steady tracking shot moving backwards ahead of him, matched pace.
Screen content: none.
Golden hour light through tall windows, long shadows, cool navy #020617
in the depths of the corridor, amber #F59E0B in the light shaft only.
Anamorphic 35mm, shallow DOF, gentle lens flare. Film grain.
```

### Shot 8 — the outro (0:26–0:30) · plate only

**Never generate the logo or the URL with AI.** Generate only a clean animated background:

```
Abstract seamless looping background, no subjects, no text, no logos.
A slow-drifting dark navy #020617 mesh gradient with soft blue #3B82F6
and cyan #0EA5E9 light pools breathing gently, one faint amber #F59E0B
bloom in the lower third. Very subtle volumetric particles drifting up.
Camera: perfectly static. Extremely slow, calm, hypnotic motion.
Feels like a premium software brand end card. Empty centre for a logo.
```

Then in the edit, on top of it:
- `logo_AR.webp` from `apps/web/public/` — fade in + scale from 0.96 to 1.00
- `مسار إكس` in **Almarai Bold**
- `masarx.vercel.app`
- a small badge: `مجاني بالكامل` (this one is factually supported — `downloads.json` states: "Yes, 100%. Masar X is a free learning tool for students.")

### Negative prompt — paste into every shot

```
text, letters, words, Arabic text, English text, subtitles, captions,
watermark, logo, UI labels, numbers, typography, signage,
distorted hands, extra fingers, warped faces, morphing objects,
neon cyberpunk, purple-pink gradient, oversaturated, HDR glow,
stock-footage smile, thumbs up, jump cut, fast zoom, shaky handheld,
bounce easing, elastic motion, 3D render look, cartoon, anime
```

---

## 3. The Arabic texts — composited in the edit

Headline font: **Almarai ExtraBold (800)** · subhead font: **Almarai Bold (700)** · English: **Inter**

Two rules from `DESIGN.md` to respect: the Arabic headline **line-height must be at least 1.3**, and never use negative `letter-spacing` on Arabic — it breaks glyph joining.

The on-screen copy itself is the Arabic ad script (product content, kept verbatim):

| Timing | Over shot | Text |
|---|---|---|
| 0:01–0:03 | 1 | `الساعة ٢ فجراً.` ← then `والمنهج كله لسه.` |
| 0:04–0:06 | 2 | `مسار إكس` |
| 0:07–0:10 | 3 | `كل ملخصاتك.` / amber second line: `في مكان واحد.` |
| 0:11–0:14 | 4 | `زين — مساعدك الذكي` / sub: `يشرح لك، مش بس يجاوب.` |
| 0:15–0:18 | 5 | `كورسات ومحاضرات منظّمة` |
| 0:19–0:22 | 6 | `اختبر نفسك. اعرف مستواك.` |
| 0:23–0:26 | 7 | `طريقك للتفوق الأكاديمي.` ← this is the platform's official description, verbatim from `metadata.json` |
| 0:27–0:30 | 8 | logo + `مسار إكس` + `masarx.vercel.app` + `ابدأ مجاناً` |

Text motion: `opacity 0→1` with `translateY 16px→0`, duration **0.35s**, easing `cubic-bezier(0.4, 0, 0.2, 1)`.
**No** bounce, elastic, or spring — this is explicit in the project's design guide, and the previous two ads in the repo violated it.

RTL motion direction: text enters from the **right**, not the left.

### Important content warning

The two ads already in the repo (`masarx-remotion-ad` and `masarx-video-ad`) use numbers **with no source anywhere in the project**: `10k+ active students`, `40+ universities`, `2M+ summaries`, `98% satisfaction`, and a testimonial attributed to "Ahmed, Engineering". These are fabricated numbers. Never put them in a public ad — false advertising hurts you legally and reputationally. Replace them with what is actually true: free · Arabic and English · works offline on the desktop app.

---

## 4. Audio

### Voice-over (optional — the ad also works without it)

Young Arab male voice, twenties, calm and confident, no hard-sell delivery. Neutral Egyptian dialect or light Modern Standard Arabic.

The voice-over script is the Arabic ad script (product content, kept verbatim):

```
(0:01) الساعة اتناشر... واحدة... اتنين. والمنهج زي ما هو.
(0:05) مسار إكس.
(0:08) كل ملخصاتك، محاضراتك، واختباراتك — في مكان واحد.
(0:12) وزين، مساعدك الذكي، يشرح لك بلغتك — مش بس يجاوب.
(0:20) تختبر نفسك، وتعرف مستواك بالظبط.
(0:24) طريقك للتفوق الأكاديمي.
(0:28) مسار إكس. مجاني. ابدأ اليوم.
```

Suitable tools for Arabic: ElevenLabs (Multilingual v2) or Speechify.

### Music

```
Cinematic minimal electronic. Starts sparse: single sustained low synth pad
with a soft filtered pulse. A muted piano note enters at 0:04. Percussion
builds subtly from 0:10 — soft kick and rim clicks, no snare crack. Full
warm arrival at 0:22 with a rising string swell. Resolves clean at 0:28.
No vocals. No trap hats. No epic trailer braams. 90 BPM.
Reference feel: Apple / Notion / Linear product film.
```

The repo has `masarx-remotion-ad/audio/bgm.wav` (32 seconds, produced with FFmpeg) — reusable as a scratch track while editing.

SFX: a very light whoosh on each transition, and one click when the logo appears. Nothing more.

---

## 5. The practical production pipeline

1. **Reference images** — take screenshots of `masarx.vercel.app` in dark mode: home, subjects page, a ZANE chat, the quizzes page. These get composited onto the screens later.
2. **First frames** — for shots 2 and 5, composite the screenshot onto a phone/laptop image (Photoshop or Canva), export as PNG.
3. **Generation** — Veo 3 or Sora 2 for the screenless shots (1, 3, 4, 6, 7, 8). Runway Gen-4 or Kling image-to-video for shots 2 and 5.
4. **Generate 3–4 takes per shot.** The video-AI success rate is roughly 1 in 4. That is not a sign of a bad prompt — it is the nature of the tool.
5. **Colour grading** — unify every shot to the same grade in CapCut/Premiere so it reads as one film. This step is the difference between "a pile of AI clips" and "an ad".
6. **Text and logo** — the final layer.
7. **Audio** — music, then voice-over, then SFX.
8. **Export** — H.264, CRF 18, `+faststart`. For the 1080×1920 Reels variant: reframe every shot and scale fonts 1.4×.

## The 6-second version (for paid placements)

Shot 2 (1.5s) → shot 3 (1.5s) → shot 4 (1.5s) → shot 8 (1.5s). One text line only: `كل مقررك. ومساعد ذكي.` then the logo and URL.
