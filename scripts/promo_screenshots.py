"""
Headless screenshot capture for the Masar X promo asset bundle.

Visits each selected route at 1920x1080 (16:9), waits for hydration and
UI animations to settle, then writes a PNG to promo_assets/<slug>/screenshot.png.

Run from the repo root:
  python scripts/promo_screenshots.py
"""
from __future__ import annotations
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(r"C:\programming\WEB_Development\projects\masarx_next")
BASE = "http://localhost:3000"
OUT = ROOT / "promo_assets"

ROUTES = [
    ("home", "/en"),
    ("ai-assistant", "/en/ai-assistant"),
    ("subjects", "/en/subjects"),
    ("quizzes", "/en/quizzes"),
    ("downloads", "/en/downloads"),
]

# 1920x1080 viewport, reduced motion = no auto-scroll entrance animations.
# Wait a fixed settle delay for theme init / hydration / lazy chunks.
VIEWPORT = {"width": 1920, "height": 1080}
SETTLE_MS = 3500  # generous: theme + i18n + auth + lazy media


def shoot(page, slug: str, path: str) -> dict:
    out = OUT / slug / "screenshot.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    url = f"{BASE}{path}"
    print(f"  -> navigating to {url}")
    response = page.goto(url, wait_until="networkidle", timeout=45_000)
    status = response.status if response else None
    # Theme + animation settle window
    page.wait_for_timeout(SETTLE_MS)
    # Best-effort: dismiss obvious cookie/toast overlays without clicking through auth.
    try:
        # Disable any entrance animations by forcing the document body to skip transforms
        page.add_style_tag(content="""
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
          }
        """)
        page.wait_for_timeout(250)
    except Exception:
        pass
    # Viewport-only screenshot (above the fold) — matches the 16:9 video target.
    page.screenshot(path=str(out), full_page=False, type="png")
    size = out.stat().st_size
    print(f"  -> wrote {out.relative_to(ROOT)} ({size:,} bytes, http={status})")
    return {"slug": slug, "path": path, "url": url, "status": status, "bytes": size, "file": str(out)}


def main() -> int:
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport=VIEWPORT,
            device_scale_factor=1,
            color_scheme="dark",
            locale="en-US",
            timezone_id="Africa/Cairo",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/128.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()
        # Surface JS errors to stdout for debugging
        page.on("pageerror", lambda exc: print(f"  !! pageerror: {exc}"))
        page.on("console", lambda msg: msg.type == "error" and print(f"  !! console.error: {msg.text}"))

        for slug, path in ROUTES:
            print(f"[{slug}] {path}")
            try:
                results.append(shoot(page, slug, path))
            except Exception as e:
                print(f"  !! failed: {e}")
                results.append({"slug": slug, "path": path, "error": str(e)})

        context.close()
        browser.close()

    print("\nSummary:")
    for r in results:
        print(f"  {r.get('slug'):<13} {r.get('path'):<22} status={r.get('status')} bytes={r.get('bytes')} error={r.get('error')}")
    return 0 if all("error" not in r for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
