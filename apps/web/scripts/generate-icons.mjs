// Generates the production icon/web-asset ladder from the brand masters in
// promo_assets/brand-new/ (see scripts/brand/build-masters.mjs for how those
// are produced). Deterministic: re-run to regenerate everything.
//
// Outputs (apps/web/public/):
//   favicon.svg          — the knot mark, verbatim master
//   favicon.ico          — PNG frames 16/32/48 (PNG-in-ICO, Vista+)
//   apple-touch-icon.png — 180x180, mark on white (iOS rounds corners itself)
//   icons/icon-{192,512}.png          — PWA "any" icons (transparent)
//   icons/maskable-{192,512}.png     — PWA maskable (mark inside safe zone on white)
//   og-image.png          — 1200x630 social card (lockup on white)
//   logo_EN.webp          — 1200x880 lockup, transparent (UI slots use object-contain)
//   logo_AR.webp          — 520x438 mark-only, transparent (Arabic rule: no Latin wordmark)
//
// Usage: node scripts/generate-icons.mjs [--verify-only]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC = path.join(repoRoot, "promo_assets/brand-new");
const PUB = path.join(repoRoot, "apps/web/public");
const WORK = path.join(repoRoot, "sandbox/brand-work");
fs.mkdirSync(path.join(PUB, "icons"), { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const markSvg = fs.readFileSync(path.join(SRC, "masarx-mark.svg"), "utf8");
const lockupSvg = fs.readFileSync(path.join(SRC, "masarx-lockup.svg"), "utf8");
const markViewBox = markSvg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const lockupViewBox = lockupSvg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const MARK_AR = markViewBox[2] / markViewBox[3];
const LOCKUP_AR = lockupViewBox[2] / lockupViewBox[3];

function renderSvg(svgStr, targetW, targetH) {
  // render honoring the viewBox aspect, exact box via fit:fill downstream
  const ar = lockupSvg === svgStr ? LOCKUP_AR : MARK_AR;
  const w = Math.round(targetH * ar >= targetW ? targetW : targetH * ar);
  const h = Math.round(targetW / ar >= targetH ? targetH : targetW / ar);
  return new Resvg(svgStr, { fitTo: { mode: "width", value: Math.max(w, 1) } })
    .render().asPng();
}

async function fitInto(svgStr, canvasW, canvasH, scale, background, outPath, outFormat = "png", quality) {
  // content box inside the canvas
  const boxW = Math.round(canvasW * scale);
  const boxH = Math.round(canvasH * scale);
  // fit the artwork's aspect into the box, then letterbox centered
  const ar = lockupSvg === svgStr ? LOCKUP_AR : MARK_AR;
  let w = boxW, h = Math.round(boxW / ar);
  if (h > boxH) { h = boxH; w = Math.round(boxH * ar); }
  const art = await sharp(renderSvg(svgStr, w * 2, h * 2)) // 2x supersample then downscale
    .resize(w, h, { fit: "fill" })
    .png()
    .toBuffer();
  let img = sharp({
    create: {
      width: canvasW, height: canvasH, channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: art, gravity: "center" }]);
  if (outFormat === "webp") img = img.webp({ quality: quality ?? 92, alphaQuality: 90 });
  else img = img.png();
  const info = await img.toFile(outPath);
  return info;
}

// ---------------------------------------------------------------- ICO writer
function buildIco(frames) {
  // frames: [{size, png}] — PNG-in-ICO (Vista+); 256 encoded as 0
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
  const dir = Buffer.alloc(16 * frames.length);
  let offset = 6 + 16 * frames.length;
  const blobs = [];
  frames.forEach(({ size, png }, i) => {
    const b = i * 16;
    dir[b] = size >= 256 ? 0 : size;
    dir[b + 1] = size >= 256 ? 0 : size;
    dir.writeUInt16LE(1, b + 4);  // planes
    dir.writeUInt16LE(32, b + 6); // bpp
    dir.writeUInt32LE(png.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += png.length;
    blobs.push(png);
  });
  return Buffer.concat([header, dir, ...blobs]);
}

async function renderMarkPng(px) {
  return new Resvg(markSvg, { fitTo: { mode: "width", value: px } }).render().asPng();
}

// ---------------------------------------------------------------- generate
console.log("generating icons from brand masters...\n");

// favicon.svg — the mark verbatim
fs.copyFileSync(path.join(SRC, "masarx-mark.svg"), path.join(PUB, "favicon.svg"));

// favicon.ico — 16/32/48 PNG frames
const icoFrames = [];
for (const size of [16, 32, 48]) {
  icoFrames.push({ size, png: await renderMarkPng(size * 4).then((b) => sharp(b).resize(size, size).png().toBuffer()) });
}
fs.writeFileSync(path.join(PUB, "favicon.ico"), buildIco(icoFrames));

// apple-touch-icon — white background, iOS applies its own mask
await fitInto(markSvg, 180, 180, 0.76, { r: 255, g: 255, b: 255, alpha: 1 }, path.join(PUB, "apple-touch-icon.png"));

// PWA icons (any purpose, transparent)
await fitInto(markSvg, 192, 192, 0.92, null, path.join(PUB, "icons/icon-192.png"));
await fitInto(markSvg, 512, 512, 0.92, null, path.join(PUB, "icons/icon-512.png"));

// maskable — mark inside the safe zone (circle r=40% of canvas): square mark
// side must be <= 56.5% of canvas side to fit the inscribed circle
await fitInto(markSvg, 192, 192, 0.56, { r: 255, g: 255, b: 255, alpha: 1 }, path.join(PUB, "icons/maskable-192.png"));
await fitInto(markSvg, 512, 512, 0.56, { r: 255, g: 255, b: 255, alpha: 1 }, path.join(PUB, "icons/maskable-512.png"));

// og-image — 1200x630 social card, lockup on white
await fitInto(lockupSvg, 1200, 630, 0.82, { r: 255, g: 255, b: 255, alpha: 1 }, path.join(PUB, "og-image.png"));

// legacy-named webp slots (same canvases as the files they replace)
await fitInto(lockupSvg, 1200, 880, 0.94, null, path.join(PUB, "logo_EN.webp"), "webp");
await fitInto(markSvg, 520, 438, 0.94, null, path.join(PUB, "logo_AR.webp"), "webp");

// ---------------------------------------------------------------- verify
console.log("output sizes:");
const outputs = [
  "favicon.svg", "favicon.ico", "apple-touch-icon.png",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-192.png", "icons/maskable-512.png",
  "og-image.png", "logo_EN.webp", "logo_AR.webp",
];
let failures = 0;
for (const rel of outputs) {
  const p = path.join(PUB, rel);
  const kb = (fs.statSync(p).size / 1024).toFixed(1);
  const dims = rel.endsWith(".ico") ? "(multi-size)" : await sharp(p).metadata().then((m) => `${m.width}x${m.height}`);
  console.log(`  ${rel.padEnd(28)} ${kb.padStart(7)} KB  ${dims}`);
}

// size budgets
const budgetChecks = [
  ["favicon.svg", 20], ["favicon.ico", 60], ["og-image.png", 400],
];
for (const [rel, maxKb] of budgetChecks) {
  const kb = fs.statSync(path.join(PUB, rel)).size / 1024;
  if (kb > maxKb) { console.error(`  BUDGET FAIL: ${rel} ${kb.toFixed(1)} KB > ${maxKb} KB`); failures++; }
}

// og-image exact dims
{
  const m = await sharp(path.join(PUB, "og-image.png")).metadata();
  if (m.width !== 1200 || m.height !== 630) { console.error(`  FAIL: og-image must be 1200x630, got ${m.width}x${m.height}`); failures++; }
}

// 16px silhouette probe: render mark at 16px, expect a readable tri-color knot —
// alpha coverage in a sane band and at least 3 distinct hue families present.
{
  const png = await renderMarkPng(64);
  const { data, info } = await sharp(png).resize(16, 16).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  const hues = { blue: 0, green: 0, orange: 0 };
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    opaque++;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (b > r && b > g) hues.blue++;
    else if (g > r && g >= b * 0.8) hues.green++;
    else if (r > g && g > b) hues.orange++;
  }
  const total = info.width * info.height;
  const coverage = opaque / total;
  const present = Object.entries(hues).filter(([, n]) => n >= 3).map(([k]) => k);
  console.log(`\n16px probe: coverage=${(coverage * 100).toFixed(0)}% hues-present=[${present.join(", ")}]`);
  if (coverage < 0.2 || coverage > 0.85) { console.error("  FAIL: 16px coverage out of band"); failures++; }
  if (present.length < 3) { console.error("  FAIL: 16px mark lost a color family"); failures++; }
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
