/**
 * Generates the mobile app's store assets from the brand knot mark
 * (promo_assets/brand-new/masarx-mark.svg) — same master the web icon
 * ladder (apps/web/scripts/generate-icons.mjs) uses, same safe-zone /
 * scale conventions, so app icon and web icons stay visually identical.
 *
 * Outputs (apps/mobile/assets/):
 *   icon.png           — 1024x1024 opaque, mark on white (iOS/Android store icon)
 *   adaptive-icon.png  — 1024x1024 TRANSPARENT foreground, mark inside the
 *                        adaptive safe zone (launcher masks it); background
 *                        color comes from app.json
 *   splash.png         — 1024x1024 white canvas, mark at contain scale
 *                        (app.json uses resizeMode: contain + white bg)
 *
 * Deterministic: re-run to regenerate. Requires sharp + @resvg/resvg-js
 * (already workspace deps via apps/web).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC = path.join(repoRoot, "promo_assets/brand-new/masarx-mark.svg");
const OUT = path.join(repoRoot, "apps/mobile/assets");

const markSvg = fs.readFileSync(SRC, "utf8");
const markViewBox = markSvg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const MARK_AR = markViewBox[2] / markViewBox[3];

async function fitInto(svgStr, canvasW, canvasH, scale, background, outPath) {
  const boxW = Math.round(canvasW * scale);
  const boxH = Math.round(canvasH * scale);
  let w = boxW;
  let h = Math.round(boxW / MARK_AR);
  if (h > boxH) {
    h = boxH;
    w = Math.round(boxH * MARK_AR);
  }
  const art = await sharp(
    new Resvg(svgStr, { fitTo: { mode: "width", value: Math.max(w * 2, 1) } })
      .render()
      .asPng(),
  )
    .resize(w, h, { fit: "fill" })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toFile(outPath);
  console.log(`wrote ${path.relative(repoRoot, outPath)} (${canvasW}x${canvasH})`);
}

fs.mkdirSync(OUT, { recursive: true });

// App icon — white background, same composition as apple-touch-icon (0.76)
await fitInto(markSvg, 1024, 1024, 0.76, { r: 255, g: 255, b: 255, alpha: 1 }, path.join(OUT, "icon.png"));

// Android adaptive foreground — mark inside the safe-zone circle (r=40%:
// square side <= 56.5% of canvas, same rule as the web maskable icons)
await fitInto(markSvg, 1024, 1024, 0.56, null, path.join(OUT, "adaptive-icon.png"));

// Splash — white canvas + mark; app.json scales it with resizeMode: contain
await fitInto(markSvg, 1024, 1024, 0.5, { r: 255, g: 255, b: 255, alpha: 1 }, path.join(OUT, "splash.png"));
