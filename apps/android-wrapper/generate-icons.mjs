// Masar X Android launcher icon + splash generator.
// Reads assets-src-logo.webp (downloaded from the production PWA manifest)
// and writes every density the Capacitor Android template expects.
// Run: node generate-icons.mjs
import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const RES = path.join("android", "app", "src", "main", "res");
const LOGO = "assets-src-logo.webp";

if (!existsSync(LOGO)) {
  console.error(`Missing ${LOGO} — download it from https://masarx.vercel.app/logo_EN.webp first.`);
  process.exit(1);
}

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function logoPng(size) {
  return sharp(LOGO).resize(size, size, { fit: "contain", background: WHITE }).png().toBuffer();
}

// Compose the logo onto a solid canvas of the given size.
// scale = fraction of the canvas the logo occupies.
async function onCanvas(size, scale) {
  const logoSize = Math.round(size * scale);
  const logo = await logoPng(logoSize);
  const left = Math.round((size - logoSize) / 2);
  const top = left;
  return sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toBuffer();
}

async function splash(width, height, scale) {
  const logoSize = Math.round(Math.min(width, height) * scale);
  const logo = await logoPng(logoSize);
  return sharp({
    create: { width, height, channels: 4, background: WHITE },
  })
    .composite([{ input: logo, left: Math.round((width - logoSize) / 2), top: Math.round((height - logoSize) / 2) }])
    .png()
    .toBuffer();
}

const LEGACY = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192],
];

const ADAPTIVE = [
  ["mipmap-mdpi", 108],
  ["mipmap-hdpi", 162],
  ["mipmap-xhdpi", 216],
  ["mipmap-xxhdpi", 324],
  ["mipmap-xxxhdpi", 432],
];

const SPLASH_PORT = [
  ["drawable-port-mdpi", 480, 800],
  ["drawable-port-hdpi", 800, 1280],
  ["drawable-port-xhdpi", 960, 1600],
  ["drawable-port-xxhdpi", 1440, 2560],
  ["drawable-port-xxxhdpi", 1920, 3200],
];

const SPLASH_LAND = [
  ["drawable-land-mdpi", 800, 480],
  ["drawable-land-hdpi", 1280, 800],
  ["drawable-land-xhdpi", 1600, 960],
  ["drawable-land-xxhdpi", 2560, 1440],
  ["drawable-land-xxxhdpi", 3200, 1920],
];

mkdirSync(RES, { recursive: true });

for (const [dir, size] of LEGACY) {
  const out = path.join(RES, dir);
  mkdirSync(out, { recursive: true });
  // Full-bleed white + centered logo: safe as both square and round icon.
  const img = await onCanvas(size, 0.7);
  await sharp(img).toFile(path.join(out, "ic_launcher.png"));
  await sharp(img).toFile(path.join(out, "ic_launcher_round.png"));
  console.log(`icons  ${dir}: ${size}x${size}`);
}

for (const [dir, size] of ADAPTIVE) {
  const out = path.join(RES, dir);
  mkdirSync(out, { recursive: true });
  // Adaptive foreground: logo inside the 66% safe zone (0.52 of 108dp canvas).
  await sharp(await onCanvas(size, 0.52)).toFile(path.join(out, "ic_launcher_foreground.png"));
  console.log(`adapt  ${dir}: ${size}x${size}`);
}

for (const [dir, w, h] of [...SPLASH_PORT, ...SPLASH_LAND]) {
  const out = path.join(RES, dir);
  mkdirSync(out, { recursive: true });
  await sharp(await splash(w, h, 0.28)).toFile(path.join(out, "splash.png"));
  console.log(`splash ${dir}: ${w}x${h}`);
}

console.log("Icon + splash generation complete.");
