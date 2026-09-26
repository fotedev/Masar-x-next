// Generates the Windows desktop app icon (build/icon.ico + build/icon-master.png)
// from the locked brand master promo_assets/brand-new/masarx-mark.svg — the same
// masters and rasterization approach as apps/web/scripts/generate-icons.mjs
// (BRANDING.md §7.2). Deterministic: re-run to regenerate.
//
// Default tile: white rounded square (r = 22.5% of the side) with the mark
// centered at 70% of the side (≥12% breathing room per BRANDING.md §7.3);
// small ICO frames scale the mark up so the knot stays legible.
// Alternatives: --style=transparent (mark only) | --style=square (white
// full-bleed, mobile style) — every run also writes a side-by-side comparison
// sheet plus per-frame previews to build/.icon-preview/ (untracked scratch).
//
// Usage: node scripts/generate-icon.mjs [--style=transparent|square] [--verify-only]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC = path.join(repoRoot, "promo_assets/brand-new");
const BUILD = path.join(repoRoot, "apps/desktop/build");
const PREVIEW = path.join(BUILD, ".icon-preview");

const args = process.argv.slice(2);
const verifyOnly = args.includes("--verify-only");
const styleArg = args.find((a) => a.startsWith("--style="));
const style = styleArg ? styleArg.split("=")[1] : "squircle";
if (!["squircle", "transparent", "square"].includes(style)) {
  console.error(`unknown --style=${style} (expected squircle | transparent | square)`);
  process.exit(1);
}

const markSvg = fs.readFileSync(path.join(SRC, "masarx-mark.svg"), "utf8");
const [, , vbW, vbH] = markSvg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const MARK_AR = vbW / vbH;

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const MASTER_PX = 1024;

// mark fill inside the tile: larger at small sizes so the knot stays legible
function markScale(px) {
  if (px <= 24) return 0.82;
  if (px <= 48) return 0.76;
  return 0.7;
}

async function renderMark(widthPx) {
  return new Resvg(markSvg, { fitTo: { mode: "width", value: widthPx } }).render().asPng();
}

async function tileBackground(px, radiusRatio = 0.225) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}">` +
    `<rect width="${px}" height="${px}" rx="${Math.round(px * radiusRatio)}" fill="#ffffff"/></svg>`;
  return new Resvg(svg, { fitTo: { mode: "width", value: px } }).render().asPng();
}

async function composeIcon(px, forStyle, scaleOverride) {
  const scale = scaleOverride ?? (forStyle === "transparent" ? 0.92 : markScale(px));
  const box = Math.round(px * scale);
  let w = box, h = Math.round(box / MARK_AR);
  if (h > box) { h = box; w = Math.round(box * MARK_AR); }
  // 2x supersample then downscale (same as the web ladder)
  const art = await sharp(await renderMark(w * 2)).resize(w, h, { fit: "fill" }).png().toBuffer();
  const layers = [];
  if (forStyle === "squircle") layers.push({ input: await tileBackground(px) });
  const background =
    forStyle === "square"
      ? { r: 255, g: 255, b: 255, alpha: 1 }
      : { r: 0, g: 0, b: 0, alpha: 0 };
  return sharp({ create: { width: px, height: px, channels: 4, background } })
    .composite([...layers, { input: art, gravity: "center" }])
    .png()
    .toBuffer();
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

function parseIco(buf) {
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) throw new Error("not an ICO file");
  const count = buf.readUInt16LE(4);
  const frames = [];
  for (let i = 0; i < count; i++) {
    const b = 6 + i * 16;
    const size = buf[b] === 0 ? 256 : buf[b];
    const len = buf.readUInt32LE(b + 8);
    const off = buf.readUInt32LE(b + 12);
    const blob = buf.subarray(off, off + len);
    // PNG IHDR: width/height at bytes 16..23, big-endian
    frames.push({ size, pngW: blob.readUInt32BE(16), pngH: blob.readUInt32BE(20), len });
  }
  return frames;
}

// ---------------------------------------------------------------- previews
async function nearestUpscaleRow(items) {
  // items: [{px, buf}] — each nearest-neighbor upscaled to ≤256px, centered on gray
  const pad = 24, H = 256 + pad * 2;
  let x = pad;
  const layers = [];
  for (const { px, buf } of items) {
    const scale = Math.max(1, Math.floor(256 / px));
    const up = await sharp(buf).resize(px * scale, px * scale, { kernel: "nearest" }).png().toBuffer();
    layers.push({ input: up, left: x, top: pad + Math.round((256 - px * scale) / 2) });
    x += px * scale + pad;
  }
  return sharp({ create: { width: x, height: H, channels: 4, background: { r: 240, g: 240, b: 240, alpha: 1 } } })
    .composite(layers).png().toBuffer();
}

async function stylesSheet() {
  const pad = 20, tile = 256;
  const styles = ["squircle", "transparent", "square"];
  const layers = [];
  for (let i = 0; i < styles.length; i++) {
    layers.push({ input: await composeIcon(tile, styles[i]), left: pad + i * (tile + pad), top: pad });
  }
  const W = pad * 2 + styles.length * tile + (styles.length - 1) * pad;
  return sharp({ create: { width: W, height: tile + pad * 2, channels: 4, background: { r: 240, g: 240, b: 240, alpha: 1 } } })
    .composite(layers).png().toBuffer();
}

// ---------------------------------------------------------------- verify
let failures = 0;
function check(ok, msg) {
  if (!ok) { console.error(`  FAIL: ${msg}`); failures++; }
}

async function verify() {
  const icoPath = path.join(BUILD, "icon.ico");
  const masterPath = path.join(BUILD, "icon-master.png");
  check(fs.existsSync(icoPath), "build/icon.ico missing — run without --verify-only first");
  check(fs.existsSync(masterPath), "build/icon-master.png missing — run without --verify-only first");
  if (failures) return;

  const frames = parseIco(fs.readFileSync(icoPath));
  check(frames.length === ICO_SIZES.length, `ico frame count ${frames.length} !== ${ICO_SIZES.length}`);
  frames.forEach((f, i) => {
    check(f.size === ICO_SIZES[i], `frame ${i}: size ${f.size} !== ${ICO_SIZES[i]}`);
    check(f.pngW === f.size && f.pngH === f.size, `frame ${i}: png dims ${f.pngW}x${f.pngH} !== ${f.size}`);
  });

  const m = await sharp(masterPath).metadata();
  check(m.width === MASTER_PX && m.height === MASTER_PX, `master ${m.width}x${m.height} !== ${MASTER_PX}`);

  // 16px silhouette probe (same as the web ladder): full-size mark at 16px must
  // keep a sane alpha band and all three hue families
  const png = await renderMark(64);
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
  const coverage = opaque / (info.width * info.height);
  const present = Object.entries(hues).filter(([, n]) => n >= 3).map(([k]) => k);
  console.log(`\n16px probe: coverage=${(coverage * 100).toFixed(0)}% hues-present=[${present.join(", ")}]`);
  check(coverage >= 0.2 && coverage <= 0.85, `16px coverage ${(coverage * 100).toFixed(0)}% out of band`);
  check(present.length >= 3, `16px mark lost a color family (found: ${present.join(", ")})`);
}

// ---------------------------------------------------------------- generate
if (!verifyOnly) {
  fs.mkdirSync(PREVIEW, { recursive: true });
  console.log(`generating desktop icons from the brand master (style=${style})...\n`);

  fs.writeFileSync(path.join(BUILD, "icon-master.png"), await composeIcon(MASTER_PX, style));

  const icoFrames = [];
  for (const size of ICO_SIZES) {
    const png = await composeIcon(size, style);
    icoFrames.push({ size, png });
    fs.writeFileSync(path.join(PREVIEW, `frame-${size}.png`), png);
  }
  fs.writeFileSync(path.join(BUILD, "icon.ico"), buildIco(icoFrames));

  fs.writeFileSync(
    path.join(PREVIEW, "styles-comparison_squircle-transparent-square.png"),
    await stylesSheet()
  );
  fs.writeFileSync(
    path.join(PREVIEW, "small-sizes-strip.png"),
    await nearestUpscaleRow(icoFrames.filter((f) => f.size <= 64).map((f) => ({ px: f.size, buf: f.png })))
  );

  console.log("output sizes:");
  const kb = (p) => (fs.statSync(p).size / 1024).toFixed(1);
  console.log(`  build/icon.ico        ${kb(path.join(BUILD, "icon.ico")).padStart(7)} KB  (${ICO_SIZES.join("/")})`);
  console.log(`  build/icon-master.png ${kb(path.join(BUILD, "icon-master.png")).padStart(7)} KB  ${MASTER_PX}x${MASTER_PX}`);
}

await verify();
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
