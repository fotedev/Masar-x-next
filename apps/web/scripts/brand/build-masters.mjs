// Builds the production SVG masters from the raw Fabric.js export:
//   1. masarx-wordmark.svg — the "MASARX" letter shapes extracted verbatim from
//      the export (they are the only true vectors in it) with their gradients
//   2. masarx-mark.svg — the knot mark, which exists only as a 1024x1024 raster,
//      vectorized via imagetracerjs with a locked palette
//   3. masarx-lockup.svg — mark + wordmark composed (EN lockup)
//   4. masarx-mark-mono.svg — single-color mark variant (notifications/mono)
//
// Renders verification PNGs into sandbox/brand-work/ and prints sizes + a
// pixel RMS comparison of the traced mark against the reference raster.
//
// Usage: node scripts/brand/build-masters.mjs [--trace-preset A|B]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import ImageTracer from "imagetracerjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const SRC = path.join(repoRoot, "promo_assets/brand-new");
const MASTERS = SRC; // masters live next to the raw assets, version-controlled
const WORK = path.join(repoRoot, "sandbox/brand-work");
fs.mkdirSync(WORK, { recursive: true });

const kb = (p) => `${(fs.statSync(p).size / 1024).toFixed(1)} KB`;

// ---------------------------------------------------------------- raw svg slicing
const rawSvg = fs.readFileSync(path.join(SRC, "logo.svg"), "utf8");

function extractGlyphGroup(svg) {
  const idIdx = svg.indexOf('id="glyphGroup_textPair');
  if (idIdx < 0) throw new Error("glyphGroup_textPair not found");
  const openIdx = svg.lastIndexOf("<g", idIdx);
  const tagRe = /<(\/?)g((?:"[^"]*"|[^>])*?)(\/?)>/g;
  tagRe.lastIndex = openIdx;
  let depth = 0;
  let m;
  let end = -1;
  while ((m = tagRe.exec(svg))) {
    if (m[1] === "/") depth--;
    else if (m[3] !== "/") depth++;
    if (depth === 0) {
      end = tagRe.lastIndex;
      break;
    }
  }
  if (end < 0) throw new Error("unbalanced glyphGroup");
  return svg.slice(openIdx, end);
}

const glyphBlock = extractGlyphGroup(rawSvg);
const glyphOpenTag = glyphBlock.slice(0, glyphBlock.indexOf(">") + 1);
const glyphInner = glyphBlock.slice(glyphBlock.indexOf(">") + 1, glyphBlock.lastIndexOf("</g>"));
const glyphTransform = (glyphOpenTag.match(/transform="([^"]*)"/) || [])[1];
const gradsInside = (glyphInner.match(/<linearGradient/g) || []).length;
const gradsTotal = (rawSvg.match(/<linearGradient/g) || []).length;
console.log(`glyphGroup: transform="${glyphTransform}" | gradients inside=${gradsInside} total-in-file=${gradsTotal}`);

// gradient defs: take them from wherever Fabric put them (whole file), in order
const gradDefs = [];
{
  const re = /<linearGradient(?:"[^"]*"|[^>])*?>[\s\S]*?<\/linearGradient>/g;
  let m;
  while ((m = re.exec(rawSvg))) gradDefs.push(m[0]);
}
console.log(`gradient defs captured: ${gradDefs.length}`);

// wordmark viewBox: measured shape bbox 250.8,511.8 -> 773.2,597.9 (+ small pad)
const WB = { x: 248.8, y: 509.8, w: 526.4, h: 90.1 };
const wordmarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${WB.x} ${WB.y} ${WB.w} ${WB.h}">
<defs>
${gradDefs.join("\n")}
</defs>
<g transform="${glyphTransform}">
${glyphInner}
</g>
</svg>`;
fs.writeFileSync(path.join(MASTERS, "masarx-wordmark.svg"), wordmarkSvg);
console.log(`masarx-wordmark.svg ${kb(path.join(MASTERS, "masarx-wordmark.svg"))}`);
fs.writeFileSync(
  path.join(WORK, "wordmark.png"),
  new Resvg(wordmarkSvg, { fitTo: { mode: "width", value: 1053 } }).render().asPng()
);

// ---------------------------------------------------------------- mark tracing
const refPng = path.join(SRC, "logo.png");
const { data, info } = await sharp(refPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

// content bbox from alpha
let minX = W, minY = H, maxX = -1, maxY = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 16) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
}
const PAD = 3;
minX = Math.max(0, minX - PAD); minY = Math.max(0, minY - PAD);
maxX = Math.min(W - 1, maxX + PAD); maxY = Math.min(H - 1, maxY + PAD);
const CW = maxX - minX + 1, CH = maxY - minY + 1;
console.log(`mark content bbox: ${minX},${minY} -> ${maxX},${maxY} (${CW}x${CH})`);

// crop to content for tracing
const cropped = await sharp(refPng)
  .extract({ left: minX, top: minY, width: CW, height: CH })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

// opaque color histogram (bucketed) to pick the palette
const hist = new Map();
for (let i = 0; i < cropped.data.length; i += 4) {
  if (cropped.data[i + 3] < 128) continue;
  const r = cropped.data[i] & 0xf0, g = cropped.data[i + 1] & 0xf0, b = cropped.data[i + 2] & 0xf0;
  const key = (r << 16) | (g << 8) | b;
  hist.set(key, (hist.get(key) || 0) + 1);
}
const topColors = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log("top opaque colors (bucketed /16):");
for (const [key, n] of topColors) {
  const hex = "#" + key.toString(16).padStart(6, "0");
  console.log(`  ${hex}  ${(n / 1000).toFixed(1)}k px`);
}

const imgd = { width: cropped.info.width, height: cropped.info.height, data: cropped.data };

// Locked palette, sampled from the artwork (see histogram above + zoom probes):
// blue is flat; the green->orange blend ramps through yellow-green and amber.
// No white entry — the artwork has no white seams; a near-white cluster would
// only reappear as a blur-halo artifact.
const PALETTE = [
  { r: 44, g: 156, b: 239, a: 255 },   // blue
  { r: 134, g: 208, b: 66, a: 255 },   // green
  { r: 181, g: 199, b: 50, a: 255 },   // yellow-green (blend)
  { r: 215, g: 170, b: 40, a: 255 },   // amber (blend)
  { r: 240, g: 150, b: 33, a: 255 },   // orange
];
// Exclusive color for transparent pixels. Without it, imagetracerjs assigns
// transparent (0,0,0) pixels to the nearest dark palette entry — green — and
// the whole canvas traces as a green background layer. Mark pixels can never
// reach magenta because pre-quantization pins them exactly onto palette colors.
const BG_COLOR = { r: 255, g: 0, b: 255, a: 255 };
const TRACE_PALETTE = [...PALETTE, BG_COLOR];

// Pre-quantize: binary alpha + nearest-palette RGB. This removes the antialias
// halo that otherwise collapses into a near-white silhouette layer.
{
  const d = imgd.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 140) {
      d[i] = BG_COLOR.r; d[i + 1] = BG_COLOR.g; d[i + 2] = BG_COLOR.b; d[i + 3] = 255;
      continue;
    }
    d[i + 3] = 255;
    let best = 0, bestD = Infinity;
    for (let p = 0; p < PALETTE.length; p++) {
      const dr = d[i] - PALETTE[p].r, dg = d[i + 1] - PALETTE[p].g, db = d[i + 2] - PALETTE[p].b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestD) { bestD = dist; best = p; }
    }
    d[i] = PALETTE[best].r; d[i + 1] = PALETTE[best].g; d[i + 2] = PALETTE[best].b;
  }
}

const traceOpts = {
  ltres: 0.8, qtres: 0.8, pathomit: 16, rightangleenhance: false,
  colorsampling: 0, numberofcolors: TRACE_PALETTE.length, pal: TRACE_PALETTE,
  mincolorratio: 0, colorquantcycles: 1, strokewidth: 0,
  linefilter: true, roundcoords: 1, blurradius: 0, viewbox: false, desc: false,
};

console.log(`\ntracing with locked ${PALETTE.length}-color palette...`);
let traced = ImageTracer.imagedataToSVG(imgd, traceOpts);

// report fills the tracer used
const fillCounts = {};
for (const m of traced.matchAll(/fill="([^"]+)"/g)) fillCounts[m[1]] = (fillCounts[m[1]] || 0) + 1;
console.log("traced fills:", JSON.stringify(fillCounts, null, 1).replace(/\n/g, " "));

// safety: drop any path whose fill is not one of the locked palette colors
const allowed = PALETTE.map((c) => `rgb(${c.r},${c.g},${c.b})`);
traced = traced.replace(/<path[^>]*>/g, (p) => (allowed.some((a) => p.includes(a)) ? p : ""));

// wrap traced paths in a tight viewBox master
const tracedInner = traced.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}">
${tracedInner}
</svg>`;
fs.writeFileSync(path.join(MASTERS, "masarx-mark.svg"), markSvg);
console.log(`masarx-mark.svg ${kb(path.join(MASTERS, "masarx-mark.svg"))}`);

// mono variant: same geometry, every fill -> currentColor
const monoSvg = markSvg.replace(/fill="[^"]*"/g, 'fill="currentColor"');
fs.writeFileSync(path.join(MASTERS, "masarx-mark-mono.svg"), monoSvg);
console.log(`masarx-mark-mono.svg ${kb(path.join(MASTERS, "masarx-mark-mono.svg"))}`);

// ---------------------------------------------------------------- lockup composition
// text strip: 526.4 x 90.1 ; mark scaled to 0.57 of text width, stacked with a gap
const textW = WB.w, textH = WB.h;
const markW = textW * 0.57;
const markScale = markW / CW;
const markH = CH * markScale;
const gap = markH * 0.16;
const pad = 24;
const LW = textW + pad * 2;
const LH = markH + gap + textH + pad * 2;
const lockupSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LW.toFixed(1)} ${LH.toFixed(1)}">
<g transform="translate(${((LW - markW) / 2).toFixed(1)},${pad}) scale(${markScale.toFixed(4)})">
${tracedInner}
</g>
<g transform="translate(${pad},${(pad + markH + gap).toFixed(1)})">
<g transform="translate(${(-WB.x).toFixed(1)},${(-WB.y).toFixed(1)})" transform-origin="0 0">
<g transform="${glyphTransform}">
${glyphInner}
</g>
</g>
</g>
</svg>`;
fs.writeFileSync(path.join(MASTERS, "masarx-lockup.svg"), lockupSvg);
console.log(`masarx-lockup.svg ${kb(path.join(MASTERS, "masarx-lockup.svg"))}`);

// ---------------------------------------------------------------- verification renders
const renderTo = (svgStr, name, width) => {
  const p = path.join(WORK, name);
  fs.writeFileSync(p, new Resvg(svgStr, { fitTo: { mode: "width", value: width } }).render().asPng());
  return p;
};
renderTo(markSvg, "mark-512.png", 512);
renderTo(markSvg, "mark-32.png", 32);
renderTo(markSvg, "mark-16.png", 16);
renderTo(monoSvg, "mark-mono-512.png", 512); // mono silhouette probe
renderTo(lockupSvg, "lockup-1200.png", 1200);

// Fidelity check against the reference raster. Both sides are composited over
// white first: raw straight-alpha RGB is meaningless at alpha=0 and comparing
// it directly produced a bogus ~140 RMS in earlier runs.
const S = 2;
const rendered = await sharp(path.join(WORK, "mark-512.png"))
  .resize(CW * S, CH * S, { fit: "fill" })
  .flatten({ background: "#ffffff" })
  .raw()
  .toBuffer();
const reference = await sharp(refPng)
  .extract({ left: minX, top: minY, width: CW, height: CH })
  .resize(CW * S, CH * S, { fit: "fill" })
  .flatten({ background: "#ffffff" })
  .raw()
  .toBuffer();
let sum = 0, n = 0;
for (let i = 0; i < rendered.length; i += 3) {
  const d = rendered[i] - reference[i];
  sum += d * d;
  n++;
}
console.log(`\nRMS traced-vs-reference (on-white RGB): ${Math.sqrt(sum / n).toFixed(2)} (0-255 scale, <8 = excellent, <15 = good)`);

const refAlpha = await sharp(refPng)
  .extract({ left: minX, top: minY, width: CW, height: CH })
  .resize(CW * S, CH * S, { fit: "fill" })
  .ensureAlpha()
  .raw()
  .toBuffer();
const renderedAlpha = await sharp(path.join(WORK, "mark-512.png"))
  .resize(CW * S, CH * S, { fit: "fill" })
  .ensureAlpha()
  .raw()
  .toBuffer();
let asum = 0, an = 0;
for (let i = 3; i < renderedAlpha.length; i += 4) {
  const d = renderedAlpha[i] - refAlpha[i];
  asum += d * d;
  an++;
}
console.log(`alpha-edge RMS: ${Math.sqrt(asum / an).toFixed(2)} (edge softness only)`);
console.log("\nverification renders written to sandbox/brand-work/: mark-512.png mark-32.png mark-16.png lockup-1200.png wordmark.png");
