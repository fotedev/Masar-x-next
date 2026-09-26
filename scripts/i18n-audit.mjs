import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "packages", "shared", "src", "messages");

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, path, out);
    } else {
      out[path] = v;
    }
  }
  return out;
}

function audit() {
  const arDir = join(root, "ar");
  const enDir = join(root, "en");
  const files = readdirSync(arDir).filter((f) => f.endsWith(".json"));

  let totalAr = 0;
  let totalEn = 0;
  let missingAr = 0;
  let missingEn = 0;
  const missingArList = [];
  const missingEnList = [];
  const emptyAr = [];
  const emptyEn = [];

  for (const file of files) {
    const ar = JSON.parse(readFileSync(join(arDir, file), "utf8"));
    const enPath = join(enDir, file);
    const en = JSON.parse(readFileSync(enPath, "utf8"));
    const arFlat = flatten(ar);
    const enFlat = flatten(en);

    for (const [key, val] of Object.entries(arFlat)) {
      totalAr++;
      if (val === undefined || val === null || val === "") {
        emptyAr.push(`${file}:${key}`);
      }
      if (!(key in enFlat)) {
        missingEn++;
        missingEnList.push(`${file}:${key}`);
      }
    }
    for (const [key, val] of Object.entries(enFlat)) {
      totalEn++;
      if (val === undefined || val === null || val === "") {
        emptyEn.push(`${file}:${key}`);
      }
      if (!(key in arFlat)) {
        missingAr++;
        missingArList.push(`${file}:${key}`);
      }
    }
  }

  console.log(`=== i18n audit: ${files.length} namespaces ===`);
  console.log(`total ar keys: ${totalAr}`);
  console.log(`total en keys: ${totalEn}`);
  console.log(`keys missing in en: ${missingEn}`);
  console.log(`keys missing in ar: ${missingAr}`);
  console.log(`empty ar values: ${emptyAr.length}`);
  console.log(`empty en values: ${emptyEn.length}`);

  if (missingEnList.length) {
    console.log("\n--- missing in en ---");
    missingEnList.forEach((k) => console.log(k));
  }
  if (missingArList.length) {
    console.log("\n--- missing in ar ---");
    missingArList.forEach((k) => console.log(k));
  }
  if (emptyAr.length) {
    console.log("\n--- empty ar values ---");
    emptyAr.forEach((k) => console.log(k));
  }
  if (emptyEn.length) {
    console.log("\n--- empty en values ---");
    emptyEn.forEach((k) => console.log(k));
  }
}

audit();