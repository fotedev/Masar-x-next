// Brand master extraction — parses the raw Fabric.js logo.svg export and produces
// a geometry report so the mark can be separated from the wordmark reliably.
//
// The raw export (promo_assets/brand-new/logo.svg) is a Fabric.js 6.7.1 save:
//   - a full 1024x1024 PNG embedded as base64 <image> (raster pollution)
//   - ~27 linearGradients + 3 <path> + 28 <polygon> carrying the actual artwork
//   - a non-square viewBox (1024x768)
//
// This script:
//   1. walks the tag tree, composing ancestor transforms
//   2. reports every shape: tag, fill (rgb / url(#gradient)), composed bbox
//   3. reports every gradient with its stops
//   4. writes a stripped SVG (embedded image removed) and renders it via resvg
//   5. prints alpha/corner stats of the reference logo.png
//
// Intermediates land in sandbox/brand-work/ (gitignored) so promo_assets/brand-new/
// stays clean for tracking.
//
// Usage: node scripts/brand/extract-masters.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);
const RAW_SVG = path.join(repoRoot, "promo_assets/brand-new/logo.svg");
const RAW_PNG = path.join(repoRoot, "promo_assets/brand-new/logo.png");
const WORK = path.join(repoRoot, "sandbox/brand-work");

fs.mkdirSync(WORK, { recursive: true });

// ---------------------------------------------------------------- matrix math
// SVG matrix(a b c d e f): x' = a*x + c*y + e ; y' = b*x + d*y + f
const IDENTITY = [1, 0, 0, 1, 0, 0];

function mul(m, n) {
  // compose: apply n first, then m
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function applyM(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function parseTransformAttr(t) {
  const mats = [];
  const re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(t))) {
    const a = m[2].trim().split(/[\s,]+/).map(Number);
    if (m[1] === "matrix") mats.push(a);
    else if (m[1] === "translate")
      mats.push([1, 0, 0, 1, a[0] || 0, a[1] || 0]);
    else if (m[1] === "scale")
      mats.push([a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]);
    else if (m[1] === "rotate") {
      const r = ((a[0] || 0) * Math.PI) / 180;
      const c = Math.cos(r), s = Math.sin(r);
      const cx = a[1] || 0, cy = a[2] || 0;
      mats.push(mul(mul([1, 0, 0, 1, cx, cy], [c, s, -s, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]));
    }
  }
  return mats;
}

// ---------------------------------------------------------------- path flattening
function tokenizePath(d) {
  return d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/g) || [];
}

function flattenPath(d, steps = 20) {
  const toks = tokenizePath(d);
  const pts = [];
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let prevC = null, prevQ = null;
  let i = 0;
  let cmd = "";
  const num = () => parseFloat(toks[i++]);

  const push = (x, y) => pts.push([x, y]);
  const cubic = (x1, y1, x2, y2, x, y) => {
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, u = 1 - t;
      push(
        u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
        u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y
      );
    }
  };
  const quad = (x1, y1, x, y) => {
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, u = 1 - t;
      push(u * u * cx + 2 * u * t * x1 + t * t * x, u * u * cy + 2 * u * t * y1 + t * t * y);
    }
  };
  const arc = (rx, ry, phiDeg, laf, sf, x, y) => {
    if (rx === 0 || ry === 0) { push(x, y); return; }
    const phi = (phiDeg * Math.PI) / 180;
    const X1 = (Math.cos(phi) * (cx - x)) / 2 + (Math.sin(phi) * (cy - y)) / 2;
    const Y1 = (-Math.sin(phi) * (cx - x)) / 2 + (Math.cos(phi) * (cy - y)) / 2;
    rx = Math.abs(rx); ry = Math.abs(ry);
    const L = (X1 * X1) / (rx * rx) + (Y1 * Y1) / (ry * ry);
    if (L > 1) { rx *= Math.sqrt(L); ry *= Math.sqrt(L); }
    const sign = laf !== sf ? 1 : -1;
    const numr = rx * rx * ry * ry - rx * rx * Y1 * Y1 - ry * ry * X1 * X1;
    const den = rx * rx * Y1 * Y1 + ry * ry * X1 * X1;
    const co = sign * Math.sqrt(Math.max(0, numr / (den || 1)));
    const Cx = (co * rx * Y1) / ry, Cy = (-co * ry * X1) / rx;
    const cxp = Math.cos(phi) * Cx - Math.sin(phi) * Cy + (cx + x) / 2;
    const cyp = Math.sin(phi) * Cx + Math.cos(phi) * Cy + (cy + y) / 2;
    const ang = (ux, uy, vx, vy) => {
      const dd = (ux * vx + uy * vy) /
        Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy) || 1);
      let a = Math.acos(Math.min(1, Math.max(-1, dd)));
      if (ux * vy - uy * vx < 0) a = -a;
      return a;
    };
    const th1 = ang(1, 0, (X1 - Cx) / rx, (Y1 - Cy) / ry);
    let dth = ang((X1 - Cx) / rx, (Y1 - Cy) / ry, (-X1 - Cx) / rx, (-Y1 - Cy) / ry);
    if (!sf && dth > 0) dth -= 2 * Math.PI;
    if (sf && dth < 0) dth += 2 * Math.PI;
    for (let k = 1; k <= steps; k++) {
      const th = th1 + (dth * k) / steps;
      push(
        cxp + rx * Math.cos(th) * Math.cos(phi) - ry * Math.sin(th) * Math.sin(phi),
        cyp + rx * Math.cos(th) * Math.sin(phi) + ry * Math.sin(th) * Math.cos(phi)
      );
    }
  };

  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase() && cmd !== "z" && cmd !== "Z";
    const C = cmd.toUpperCase();
    switch (C) {
      case "M": {
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        cx = sx = x; cy = sy = y; push(cx, cy);
        cmd = rel ? "l" : "L"; // implicit lineto continuation
        break;
      }
      case "L": {
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        cx = x; cy = y; push(cx, cy);
        break;
      }
      case "H": {
        let x = num();
        if (rel) x += cx;
        cx = x; push(cx, cy);
        break;
      }
      case "V": {
        let y = num();
        if (rel) y += cy;
        cy = y; push(cx, cy);
        break;
      }
      case "C": {
        let x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
        if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
        cubic(x1, y1, x2, y2, x, y);
        prevC = [x2, y2]; cx = x; cy = y;
        break;
      }
      case "S": {
        let x2 = num(), y2 = num(), x = num(), y = num();
        if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
        const x1 = prevC ? 2 * cx - prevC[0] : cx;
        const y1 = prevC ? 2 * cy - prevC[1] : cy;
        cubic(x1, y1, x2, y2, x, y);
        prevC = [x2, y2]; cx = x; cy = y;
        break;
      }
      case "Q": {
        let x1 = num(), y1 = num(), x = num(), y = num();
        if (rel) { x1 += cx; y1 += cy; x += cx; y += cy; }
        quad(x1, y1, x, y);
        prevQ = [x1, y1]; cx = x; cy = y;
        break;
      }
      case "T": {
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        const x1 = prevQ ? 2 * cx - prevQ[0] : cx;
        const y1 = prevQ ? 2 * cy - prevQ[1] : cy;
        quad(x1, y1, x, y);
        prevQ = [x1, y1]; cx = x; cy = y;
        break;
      }
      case "A": {
        const rx = num(), ry = num(), rot = num(), laf = num(), sf2 = num();
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        arc(rx, ry, rot, laf, sf2, x, y);
        cx = x; cy = y;
        break;
      }
      case "Z": {
        cx = sx; cy = sy; push(cx, cy);
        break;
      }
      default:
        i++; // unknown token — skip
    }
  }
  return pts;
}

// ---------------------------------------------------------------- svg scanning
function getAttrs(attrStr) {
  const attrs = {};
  const re = /([a-zA-Z:.-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(attrStr))) attrs[m[1]] = m[2];
  return attrs;
}

function shapePoints(shape, attrs, matrix) {
  let local = [];
  if (shape === "polygon" && attrs.points) {
    const nums = (attrs.points.match(/-?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/g) || []).map(Number);
    for (let k = 0; k + 1 < nums.length; k += 2) local.push([nums[k], nums[k + 1]]);
  } else if (shape === "path" && (attrs.d || "")) {
    local = flattenPath(attrs.d);
  } else if (shape === "rect" && attrs.x !== undefined) {
    const x = +attrs.x, y = +attrs.y, w = +attrs.width, h = +attrs.height;
    local = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  } else if (shape === "circle" && attrs.cx !== undefined) {
    const cx = +attrs.cx, cy = +attrs.cy, r = +attrs.r;
    for (let k = 0; k < 24; k++) {
      const t = (2 * Math.PI * k) / 24;
      local.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
  } else if (shape === "ellipse" && attrs.cx !== undefined) {
    const cx = +attrs.cx, cy = +attrs.cy, rx = +attrs.rx, ry = +attrs.ry;
    for (let k = 0; k < 24; k++) {
      const t = (2 * Math.PI * k) / 24;
      local.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
    }
  }
  return local.map(([x, y]) => applyM(matrix, x, y));
}

function bboxOf(pts) {
  if (!pts.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function extractFill(attrs) {
  const style = attrs.style || "";
  let fill = null;
  const sm = style.match(/fill:\s*([^;]+)/);
  if (sm) fill = sm[1].trim();
  if (attrs.fill !== undefined) fill = attrs.fill.trim();
  return fill;
}

function scanSvg(svg) {
  const shapes = [];
  const images = [];
  const stack = [{ tag: "svg", matrix: IDENTITY, inDefs: false }];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let m;
  while ((m = tagRe.exec(svg))) {
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const attrStr = m[3] || "";
    const selfClose = m[4] === "/";
    const top = stack[stack.length - 1] || { matrix: IDENTITY, inDefs: false };

    if (closing) {
      if (tag === "defs") stack[stack.length - 1] && (stack[stack.length - 1].inDefs = false);
      if (tag !== "svg") stack.pop();
      continue;
    }

    const attrs = getAttrs(attrStr);
    let matrix = top.matrix;
    if (attrs.transform) {
      for (const lm of parseTransformAttr(attrs.transform)) matrix = mul(matrix, lm);
    }
    const inDefs = top.inDefs || tag === "defs";

    if (!inDefs && ["path", "polygon", "rect", "circle", "ellipse"].includes(tag)) {
      const pts = shapePoints(tag, attrs, matrix);
      const bb = bboxOf(pts);
      shapes.push({
        tag,
        fill: extractFill(attrs),
        styleOpacity: ((attrs.style || "").match(/opacity:\s*([\d.]+)/) || [])[1] || null,
        bbox: bb && {
          minX: +bb.minX.toFixed(1), minY: +bb.minY.toFixed(1),
          maxX: +bb.maxX.toFixed(1), maxY: +bb.maxY.toFixed(1),
          w: +bb.w.toFixed(1), h: +bb.h.toFixed(1),
        },
        sourceLen: (attrs.d || attrs.points || "").length,
      });
    }
    if (tag === "image") {
      const bb = bboxOf(shapePoints("rect", { x: attrs.x || 0, y: attrs.y || 0, width: attrs.width || 0, height: attrs.height || 0 }, matrix));
      images.push({ bbox: bb && { x: +bb.minX.toFixed(1), y: +bb.minY.toFixed(1), w: +bb.w.toFixed(1), h: +bb.h.toFixed(1) }, hrefLen: (attrs["xlink:href"] || attrs.href || "").length });
    }

    if (!selfClose && !["br", "img", "stop"].includes(tag)) {
      stack.push({ tag, matrix, inDefs });
    }
  }
  return { shapes, images };
}

function extractGradients(svg) {
  const defsMatch = svg.match(/<defs>([\s\S]*?)<\/defs>/);
  const grads = [];
  if (!defsMatch) return grads;
  const gradRe = /<linearGradient([^>]*)>([\s\S]*?)<\/linearGradient>/g;
  let g;
  while ((g = gradRe.exec(defsMatch[1]))) {
    const attrs = getAttrs(g[1]);
    const stops = [];
    const stopRe = /<stop\s+([^>]*?)\/?>/g;
    let s;
    while ((s = stopRe.exec(g[2]))) {
      const sa = getAttrs(s[1]);
      const style = sa.style || "";
      stops.push({
        offset: sa.offset ?? (style.match(/offset:\s*([^;]+)/) || [])[1],
        color: sa["stop-color"] ?? (style.match(/stop-color:\s*([^;]+)/) || [])[1],
      });
    }
    grads.push({
      id: attrs.id,
      href: attrs["xlink:href"] || null,
      coords: [attrs.x1, attrs.y1, attrs.x2, attrs.y2].join(" "),
      stops,
    });
  }
  return grads;
}

// ---------------------------------------------------------------- main
const svg = fs.readFileSync(RAW_SVG, "utf8");
const { shapes, images } = scanSvg(svg);
const grads = extractGradients(svg);

console.log("=== EMBEDDED IMAGES ===");
for (const im of images) console.log(JSON.stringify(im));

console.log(`\n=== SHAPES (${shapes.length}) ===`);
shapes.forEach((s, i) => {
  const b = s.bbox;
  console.log(
    `#${String(i).padStart(2, "0")} ${s.tag.padEnd(8)} fill=${String(s.fill).padEnd(24)} bbox=(${b ? `${b.minX},${b.minY} → ${b.maxX},${b.maxY}` : "n/a"}) w=${b ? b.w : "?"} h=${b ? b.h : "?"}`
  );
});

console.log(`\n=== GRADIENTS (${grads.length}) ===`);
for (const g of grads) {
  console.log(`${g.id} coords=[${g.coords}] stops=${g.stops.map((s) => `${s.offset}:${s.color}`).join(" | ")}`);
}

// stripped svg: drop every <image> element
const stripped = svg.replace(/<image[\s\S]*?<\/image>|<image[^>]*\/>/g, "");
fs.writeFileSync(path.join(WORK, "stripped.svg"), stripped);
console.log(`\nstripped.svg written (${(stripped.length / 1024).toFixed(1)} KB, was ${(svg.length / 1024).toFixed(1)} KB)`);

// render stripped svg for visual verification
const resvg = new Resvg(stripped, { fitTo: { mode: "width", value: 1024 } });
fs.writeFileSync(path.join(WORK, "stripped.png"), resvg.render().asPng());
console.log("stripped.png rendered (width 1024)");

// reference png stats
const sharp = (await import("sharp")).default;
const meta = await sharp(RAW_PNG).metadata();
const stats = await sharp(RAW_PNG).stats();
console.log(`\n=== REFERENCE logo.png === ${meta.width}x${meta.height} channels=${meta.channels} hasAlpha=${meta.hasAlpha}`);
const px = async (x, y) => {
  const buf = await sharp(RAW_PNG).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer();
  return [...buf].join(",");
};
console.log("corners TL/TR/BL/BR:", (await px(2, 2)), (await px(meta.width - 3, 2)), (await px(2, meta.height - 3)), (await px(meta.width - 3, meta.height - 3)));
console.log("center:", await px(Math.floor(meta.width / 2), Math.floor(meta.height / 2)));
