# Masar X — إعلان احترافي بالـ AI (Prompts + سكربت تركيب)

مدة الإعلان: **30 ثانية** · 1920×1080 (مع نسخة 1080×1920) · 24fps سينمائي

---

## اقرأ هذا أولاً — قاعدة العمل

**لا تطلب من أي أداة AI أن تكتب نصاً عربياً داخل الفيديو.** كل الموديلات (Sora 2، Veo 3، Runway Gen-4، Kling 2.5) تُخرج حروفاً عربية مشوّهة ومفكوكة الاتصال. هذه ليست مسألة صياغة prompt — هي حدود تقنية في الموديل.

الطريقة الصحيحة، وهي نفسها التي تُستخدم في الإعلانات المدفوعة:

| الطبقة | من يصنعها |
|---|---|
| الأجواء، الحركة، الإضاءة، الوجوه، المشاعر | أداة الـ AI (الـ prompts أدناه) |
| النص العربي، اللوجو، الـ CTA، الرابط | أنت في CapCut / Premiere / Canva |
| الموسيقى + التعليق الصوتي | أداة صوت منفصلة (السكربت في القسم 4) |

في كل prompt أدناه تجد سطر `Screen content:` — اطلب فيه شاشة **مضيئة بلا نص مقروء** (blurred UI, no legible text). ثم تضع أنت الـ UI الحقيقي فوقها.

### أفضل مسار جودة: image-to-video لا text-to-video

لديك ميزة كبيرة: المنصة موجودة فعلاً. خذ **لقطات شاشة حقيقية** من `masarx.vercel.app` (الوضع الليلي)، وركّبها على صورة مكتب/موبايل في Photoshop أو Canva، ثم أدخل الصورة كـ **first frame** في Runway Gen-4 أو Kling. النتيجة: منتجك الحقيقي، بحركة سينمائية، بدون أي هلوسة من الموديل.

استخدم `text-to-video` فقط للمشاهد التي لا تحتوي شاشة (المشهد 1، 7).

---

## 1. الهوية البصرية — الصقها في كل prompt

```
COLOR GRADE (حرفياً في كل prompt):
deep midnight navy #020617 base, interface blue #3B82F6 key light,
horizon sky cyan #0EA5E9 rim light, single amber #F59E0B accent only.
Teal-and-orange cinematic grade, crushed blacks, low-saturation midtones.

LENS / CAMERA:
anamorphic 35mm, shallow depth of field f/1.8, subtle film grain,
slow deliberate camera moves only — dolly, push-in, parallel track.

TONE:
premium tech advertisement, calm and confident, not hyperactive.
```

**قاعدة الكهرماني (Amber Gate):** اللون `#F59E0B` لا يظهر إلا في نقطة واحدة صغيرة في الكادر — نقطة ضوء، انعكاس، زر. إذا صار أكثر من 10% من الكادر فقد الإعلان هويته. هذه قاعدة موثّقة في `DESIGN.md` للمشروع.

---

## 2. الـ Prompts — 8 لقطات

> كل لقطة 3–4 ثوان. Veo 3 و Sora 2 يخرجان 8 ثوان، لذلك اطلب لقطة واحدة في المرة ثم اقتصّها في المونتاج.

### Shot 1 — الألم (0:00–0:03) · text-to-video

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

### Shot 2 — الانطلاق (0:03–0:06) · image-to-video (ابدأ من صورة لموبايل مطفأ)

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

الآن ركّب لقطة شاشة حقيقية للصفحة الرئيسية فوق الشاشة الضبابية في المونتاج (corner-pin / mask).

### Shot 3 — الفوضى تنتظم (0:06–0:10) · text-to-video

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

### Shot 4 — ZANE / المساعد الذكي (0:10–0:14) · text-to-video

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

> **ملاحظة:** لا تطلب روبوتاً. عندك mascot خاص بالمشروع (`LoginRobot.tsx` + `ai-robo.lottie`) — ضعه كطبقة Lottie فوق هذه اللقطة في المونتاج، أفضل بكثير من روبوت مهلوس.

### Shot 5 — الكورسات والمحاضرات (0:14–0:18) · image-to-video (ابدأ من screenshot لصفحة الكورسات)

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

### Shot 6 — الاختبارات والثقة (0:18–0:22) · text-to-video

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

### Shot 7 — النتيجة (0:22–0:26) · text-to-video

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

### Shot 8 — الخاتمة (0:26–0:30) · plate فقط

**لا تولّد اللوجو أو الرابط بالـ AI أبداً.** ولّد خلفية متحركة نظيفة فقط:

```
Abstract seamless looping background, no subjects, no text, no logos.
A slow-drifting dark navy #020617 mesh gradient with soft blue #3B82F6
and cyan #0EA5E9 light pools breathing gently, one faint amber #F59E0B
bloom in the lower third. Very subtle volumetric particles drifting up.
Camera: perfectly static. Extremely slow, calm, hypnotic motion.
Feels like a premium software brand end card. Empty centre for a logo.
```

ثم في المونتاج فوقها:
- `logo_AR.webp` من `apps/web/public/` — يظهر بـ fade + scale من 0.96 إلى 1.00
- `مسار إكس` بخط **Almarai Bold**
- `masarx.vercel.app`
- شارة صغيرة: `مجاني بالكامل` (هذه مدعومة فعلياً — `downloads.json` ينص: "Yes, 100%. Masar X is a free learning tool for students.")

### Negative prompt — الصقه في كل لقطة

```
text, letters, words, Arabic text, English text, subtitles, captions,
watermark, logo, UI labels, numbers, typography, signage,
distorted hands, extra fingers, warped faces, morphing objects,
neon cyberpunk, purple-pink gradient, oversaturated, HDR glow,
stock-footage smile, thumbs up, jump cut, fast zoom, shaky handheld,
bounce easing, elastic motion, 3D render look, cartoon, anime
```

---

## 3. النصوص العربية — تُركَّب في المونتاج

خط العناوين: **Almarai ExtraBold (800)** · خط الفرعي: **Almarai Bold (700)** · الإنجليزي: **Inter**

قاعدتان من `DESIGN.md` احترمهما: line-height للعنوان العربي **لا يقل عن 1.3**، ولا تستخدم `letter-spacing` سالباً على العربية أبداً — يكسر اتصال الحروف.

| التوقيت | فوق اللقطة | النص |
|---|---|---|
| 0:01–0:03 | 1 | `الساعة ٢ فجراً.` ← ثم `والمنهج كله لسه.` |
| 0:04–0:06 | 2 | `مسار إكس` |
| 0:07–0:10 | 3 | `كل ملخصاتك.` / سطر ثاني كهرماني: `في مكان واحد.` |
| 0:11–0:14 | 4 | `زين — مساعدك الذكي` / فرعي: `يشرح لك، مش بس يجاوب.` |
| 0:15–0:18 | 5 | `كورسات ومحاضرات منظّمة` |
| 0:19–0:22 | 6 | `اختبر نفسك. اعرف مستواك.` |
| 0:23–0:26 | 7 | `طريقك للتفوق الأكاديمي.` ← وهذا هو الوصف الرسمي للمنصة حرفياً من `metadata.json` |
| 0:27–0:30 | 8 | لوجو + `مسار إكس` + `masarx.vercel.app` + `ابدأ مجاناً` |

حركة النص: `opacity 0→1` مع `translateY 16px→0`، مدة **0.35s**، easing `cubic-bezier(0.4, 0, 0.2, 1)`.
**ممنوع** bounce أو elastic أو spring — هذا نص صريح في دليل تصميم المشروع، والإعلانان السابقان في المستودع خالفاه.

اتجاه الحركة في RTL: النص يدخل من **اليمين** لا اليسار.

### تحذير مهم على المحتوى

الإعلانان الموجودان في المستودع (`masarx-remotion-ad` و `masarx-video-ad`) يستخدمان أرقاماً **لا يوجد لها أي مصدر في المشروع**: `10k+ طالب نشط`، `أكثر من ٤٠ جامعة`، `2M+ ملخص`، `98% رضا`، وشهادة منسوبة لـ "أحمد، هندسة". هذه أرقام مُختلقة. لا تضعها في إعلان عام — إعلان كاذب الأرقام يضرّك قانونياً وسمعةً. استبدلها بما هو صحيح فعلاً: مجاني · عربي وإنجليزي · يعمل بدون إنترنت على تطبيق الديسكتوب.

---

## 4. الصوت

### التعليق الصوتي (اختياري — الإعلان يعمل بدون تعليق أيضاً)

صوت شاب عربي، عشرينات، هادئ وواثق، بلا مبالغة إعلانية. لهجة مصرية بيضاء أو فصحى مخفّفة.

```
(0:01) الساعة اتناشر... واحدة... اتنين. والمنهج زي ما هو.
(0:05) مسار إكس.
(0:08) كل ملخصاتك، محاضراتك، واختباراتك — في مكان واحد.
(0:12) وزين، مساعدك الذكي، يشرح لك بلغتك — مش بس يجاوب.
(0:20) تختبر نفسك، وتعرف مستواك بالظبط.
(0:24) طريقك للتفوق الأكاديمي.
(0:28) مسار إكس. مجاني. ابدأ اليوم.
```

أدوات مناسبة للعربية: ElevenLabs (Multilingual v2) أو Speechify.

### الموسيقى

```
Cinematic minimal electronic. Starts sparse: single sustained low synth pad
with a soft filtered pulse. A muted piano note enters at 0:04. Percussion
builds subtly from 0:10 — soft kick and rim clicks, no snare crack. Full
warm arrival at 0:22 with a rising string swell. Resolves clean at 0:28.
No vocals. No trap hats. No epic trailer braams. 90 BPM.
Reference feel: Apple / Notion / Linear product film.
```

المستودع فيه `masarx-remotion-ad/audio/bgm.wav` (32 ثانية، أُنتج بـ FFmpeg) — قابل لإعادة الاستخدام كـ scratch track أثناء المونتاج.

SFX: whoosh خفيف جداً عند كل انتقال، وclick واحد عند ظهور اللوجو. لا أكثر.

---

## 5. سلسلة الإنتاج العملية

1. **الصور المرجعية** — التقط screenshots من `masarx.vercel.app` بالوضع الليلي: الرئيسية، صفحة المواد، محادثة زين، صفحة الاختبارات. هذه ستُركّب على الشاشات لاحقاً.
2. **first frames** — للمشاهد 2 و 5، ركّب الـ screenshot على صورة موبايل/لابتوب (Photoshop أو Canva)، صدّرها PNG.
3. **التوليد** — Veo 3 أو Sora 2 للمشاهد بلا شاشة (1، 3، 4، 6، 7، 8). Runway Gen-4 أو Kling image-to-video للمشهد 2 و 5.
4. **ولّد 3–4 نسخ من كل لقطة.** معدل النجاح في الفيديو AI حوالي 1 من 4. هذه ليست علامة على prompt سيئ — هي طبيعة الأداة.
5. **التدرّج اللوني** — وحّد كل اللقطات على نفس الـ grade في CapCut/Premiere حتى تبدو من فيلم واحد. هذه الخطوة هي الفرق بين "مجموعة كليبات AI" و"إعلان".
6. **النص واللوجو** — الطبقة الأخيرة.
7. **الصوت** — موسيقى ثم تعليق ثم SFX.
8. **التصدير** — H.264، CRF 18، `+faststart`. نسخة 1080×1920 للريلز: أعد تأطير كل لقطة، وارفع حجم الخط 1.4×.

## نسخة 6 ثوان (للإعلانات المدفوعة)

المشهد 2 (1.5s) → المشهد 3 (1.5s) → المشهد 4 (1.5s) → المشهد 8 (1.5s). نص واحد فقط: `كل مقررك. ومساعد ذكي.` ثم اللوجو والرابط.
