# Owner smoke checklist — spec 012

> Cold restart first — and note: `rm -rf apps/web/.next` does NOT work in PowerShell
> (it silently failed last time, leaving a warm build). Use:
> `Remove-Item -Recurse -Force apps/web/.next` in PowerShell, or `rm -rf apps/web/.next` in Git Bash.

1. **Scrollbar drag** — grab the right-edge thumb and drag: it must track the pointer 1:1 immediately, not commit after release. Track click still glides; "Scroll to latest" pill still glides.
2. **Glued bold** — send something that makes Zane write Arabic bold (or check history): `عايزه **متعدد الصفحات**`-style output must show a clear space between the word and the bold text, both before and after the bold span.
3. **Unboxed assistant** — Zane's replies render as plain text on the canvas (no card/border); your own messages keep their bubble; code blocks and raw view keep their own boxes.
4. **Action buttons** — hover any message: Copy / View-Source fade in with NO layout shift or flicker; the row's space is always reserved; long-press still reveals on touch.
5. **Header** — the top status bar is gone in Programming mode; a small ZANE chip with the green dot sits at the left of the composer's controls row (label hidden on very small widths). In Student mode the toolset row still appears.
6. **Avatar** — your avatar next to user messages is 32/36px.
7. **Typing** — type a long message: no visible lag; the message list must not re-render per keystroke (optional: React DevTools Profiler → only ChatInput highlights).
8. **402 balance** — with the depleted Puter account, sending shows ONE clear bilingual message about the empty quota per model (repeat sends with the same model return it instantly without network); switching models retries for real; reloading resets the gate.
9. **Console** — stack traces no longer blame LottiePlayer for unrelated errors.
