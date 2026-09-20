# Spec 011 — Owner smoke checklist

Run against `http://localhost:3000/en/ai-assistant` (and `/ar` where noted) after all commits land. Cold start: `taskkill` any wedged node, `rm -rf apps/web/.next`, `pnpm dev` (live-verification env lessons).

## Scrollbar

- [ ] Visible thin thumb overlaying the right edge in chat state; hidden in hero state and when content fits.
- [ ] Thumb tracks scroll (wheel, drag, track click jumps).
- [ ] Message column center vs viewport center = 0px (no 4px drift vs header/composer) in both states.
- [ ] `/ar`: bubble content still RTL; thumb stays on the physical right edge.

## Streaming

- [ ] Zane's reply appears progressively (chunked), not as one pop-in.
- [ ] While streaming: plain text in the bubble; full markdown (code blocks, lists, bold) renders on completion.
- [ ] Typing indicator shows until the first chunk, then disappears.
- [ ] Scrolling up mid-generation does NOT yank the view back down.
- [ ] Model menu (Claude/GPT-4o/…) still works; premium fallback still lands on the nano model when unsigned.
- [ ] Kill network mid-stream (optional): partial text kept, no crash.

## Auto-scroll + lazy sync

- [ ] Signed-in with >30 messages in a persona: page opens showing the NEWEST message immediately (no smooth crawl).
- [ ] Scrolling to the top loads older messages in place — no visual jump (anchor preserved).
- [ ] "Scroll to end" pill appears when scrolled up; click smooth-scrolls to bottom; hides at bottom. Label localized in `/ar`.
- [ ] Guest: same behaviors from localStorage history; refresh keeps chat (no wipe).

## Bidi

- [ ] Zane Arabic reply containing English terms/inline code: colon/labels/inline code keep LTR order inside the RTL bubble (no `:Based on…` flip).
- [ ] Code fences still LTR with working copy button.
